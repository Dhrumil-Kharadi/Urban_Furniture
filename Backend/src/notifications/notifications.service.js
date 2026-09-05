/**
 * Notifications Service
 *
 * Manages transactional queuing and asynchronous dispatch of notifications.
 * Reference: project.md §9.7 · phase.md Phase 13
 *
 * Rules:
 * 1. Insert 'pending' row INSIDE the business transaction.
 * 2. Dispatch AFTER COMMIT via nodemailer (or setImmediate).
 * 3. NO BullMQ, NO Redis. setImmediate dispatch + a retry pass over status='pending'
 *    is sufficient at this scale and adds no infrastructure.
 * 4. AN EMAIL FAILURE NEVER FAILS THE PARENT TRANSACTION.
 */

const { transporter } = require('../config/mail');
const { env } = require('../config/env');
const notificationsRepository = require('./notifications.repository');
const logger = require('../utils/logger');

const notificationsService = {
  /**
   * Queue a notification inside an existing transaction (or standalone).
   * Status will be 'pending'.
   */
  async queueNotification(client, {
    organizationId,
    recipientEmail,
    subject,
    bodyHtml,
    triggerEvent,
    entityType = null,
    entityId = null,
  }) {
    if (!recipientEmail) {
      return null;
    }

    const row = await notificationsRepository.insert(client, {
      organization_id: organizationId,
      recipient_email: recipientEmail,
      subject,
      body_html: bodyHtml,
      trigger_event: triggerEvent,
      entity_type: entityType,
      entity_id: entityId,
    });

    return row;
  },

  /**
   * Attempt dispatch for a notification by ID.
   * NEVER throws an error to the caller — updates status to 'sent' or 'failed'.
   */
  async dispatchNotification(notificationId) {
    try {
      const notification = await notificationsRepository.findById(null, notificationId);
      if (!notification) {
        logger.warn(`[NOTIFICATION] Cannot dispatch: notification ${notificationId} not found`);
        return false;
      }

      if (notification.status === 'sent') {
        return true;
      }

      const mailOptions = {
        from: `"${env.smtp.fromName || 'Urban Furniture'}" <${env.smtp.user || 'no-reply@urbanfurniture.com'}>`,
        to: notification.recipient_email,
        subject: notification.subject,
        html: notification.body_html,
        text: notification.subject,
      };

      await transporter.sendMail(mailOptions);

      await notificationsRepository.updateStatus(null, notificationId, {
        status: 'sent',
        errorMessage: null,
      });

      logger.info(`[NOTIFICATION] Dispatched notification ${notificationId} to ${notification.recipient_email}`);
      return true;
    } catch (err) {
      logger.error(`[NOTIFICATION] Dispatch failed for notification ${notificationId}: ${err.message}`);
      await notificationsRepository.updateStatus(null, notificationId, {
        status: 'failed',
        errorMessage: err.message,
      });
      return false;
    }
  },

  /**
   * Schedule asynchronous dispatch after the current event loop turn (post-commit).
   */
  scheduleDispatch(notificationId) {
    if (!notificationId) return;
    setImmediate(async () => {
      try {
        await notificationsService.dispatchNotification(notificationId);
      } catch (err) {
        logger.error(`[NOTIFICATION] Unhandled error in setImmediate dispatch: ${err.message}`);
      }
    });
  },

  /**
   * Trigger helper: Invoice Posted
   */
  async triggerInvoicePosted(client, { organizationId, invoice, customer }) {
    if (!customer?.email) return null;

    const subject = `Invoice ${invoice.invoice_number || invoice.number} from Urban Furniture`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333333;">Invoice Issued</h2>
        <p>Dear ${customer.name || 'Valued Customer'},</p>
        <p>A new invoice <strong>${invoice.invoice_number || invoice.number}</strong> has been generated.</p>
        <p><strong>Total Amount:</strong> $${invoice.total_amount || invoice.total || '0.00'}</p>
        <p><strong>Due Date:</strong> ${invoice.due_date || 'Due on receipt'}</p>
        <p>You can view and settle your balance anytime through your customer portal.</p>
        <p style="margin-top: 25px; color: #888; font-size: 12px;">Thank you for your business.</p>
      </div>
    `;

    const row = await notificationsService.queueNotification(client, {
      organizationId,
      recipientEmail: customer.email,
      subject,
      bodyHtml,
      triggerEvent: 'invoice_posted',
      entityType: 'customer_invoice',
      entityId: invoice.id,
    });

    return row;
  },

  /**
   * Trigger helper: Bill Posted
   */
  async triggerBillPosted(client, { organizationId, bill, vendor }) {
    if (!vendor?.email) return null;

    const subject = `Vendor Bill ${bill.bill_number || bill.number} Recorded`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333333;">Bill Processed</h2>
        <p>Vendor Bill <strong>${bill.bill_number || bill.number}</strong> has been recorded.</p>
        <p><strong>Total Amount:</strong> $${bill.total_amount || bill.total || '0.00'}</p>
        <p><strong>Due Date:</strong> ${bill.due_date || 'N/A'}</p>
      </div>
    `;

    return notificationsService.queueNotification(client, {
      organizationId,
      recipientEmail: vendor.email,
      subject,
      bodyHtml,
      triggerEvent: 'bill_posted',
      entityType: 'vendor_bill',
      entityId: bill.id,
    });
  },

  /**
   * Trigger helper: Payment Received
   */
  async triggerPaymentReceived(client, { organizationId, payment, contact }) {
    if (!contact?.email) return null;

    const subject = `Payment Confirmation ${payment.payment_number || ''}`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1a73e8;">Payment Received</h2>
        <p>Dear ${contact.name || 'Valued Customer'},</p>
        <p>We have successfully received and posted your payment of <strong>$${payment.amount || '0.00'}</strong>.</p>
        <p>Thank you for your prompt payment.</p>
      </div>
    `;

    return notificationsService.queueNotification(client, {
      organizationId,
      recipientEmail: contact.email,
      subject,
      bodyHtml,
      triggerEvent: 'payment_received',
      entityType: 'payment',
      entityId: payment.id,
    });
  },

  /**
   * Trigger helper: Portal Invite
   */
  async triggerPortalInvite(client, { organizationId, contact, inviteLink }) {
    if (!contact?.email) return null;

    const subject = `Welcome to Urban Furniture Portal`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1a73e8;">Your Customer Portal is Ready</h2>
        <p>Dear ${contact.name || 'Customer'},</p>
        <p>You can access your account, view outstanding invoices, and track orders anytime:</p>
        <div style="margin: 25px 0;">
          <a href="${inviteLink}" style="background-color: #1a73e8; color: #ffffff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold;">Access Portal</a>
        </div>
      </div>
    `;

    return notificationsService.queueNotification(client, {
      organizationId,
      recipientEmail: contact.email,
      subject,
      bodyHtml,
      triggerEvent: 'portal_invite',
      entityType: 'contact',
      entityId: contact.id,
    });
  },

  /**
   * Retry pending or failed notifications for an organization (or all).
   */
  async retryPendingOrFailed(organizationId) {
    const retriables = await notificationsRepository.findRetriable(null, organizationId);
    let successCount = 0;
    let failCount = 0;

    for (const item of retriables) {
      const ok = await notificationsService.dispatchNotification(item.id);
      if (ok) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {
      retriedCount: retriables.length,
      successCount,
      failCount,
    };
  },

  /**
   * List notifications for admin view.
   */
  async listNotifications(organizationId, query) {
    return notificationsRepository.list(null, organizationId, query);
  },
};

module.exports = notificationsService;
