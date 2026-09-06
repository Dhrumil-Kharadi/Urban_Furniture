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

    const frontendUrl = process.env.FRONTEND_URL || env.corsOrigin || 'http://localhost:3000';
    const invoiceUrl = `${frontendUrl}/en/invoices/${invoice.id}`;
    const totalFormatted = `₹${Number(invoice.total_amount || invoice.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const dueFormatted = `₹${Number(invoice.amount_due ?? (invoice.total_amount || invoice.total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const subject = `Invoice ${invoice.invoice_number || invoice.number} from Urban Furniture`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1a73e8; margin: 0; font-size: 24px;">Urban Furniture</h1>
          <p style="color: #666666; margin: 4px 0 0 0; font-size: 14px;">Customer Invoice Issued</p>
        </div>

        <p style="color: #333333; font-size: 15px;">Dear ${customer.name || 'Valued Customer'},</p>
        <p style="color: #555555; font-size: 14px; line-height: 1.5;">
          A new invoice <strong>${invoice.invoice_number || invoice.number}</strong> has been issued for your order.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Invoice Number:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1e293b;">${invoice.invoice_number || invoice.number}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Total Amount:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #1e293b;">${totalFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Amount Due:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #e11d48;">${dueFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Due Date:</td>
              <td style="padding: 6px 0; text-align: right; color: #1e293b;">${invoice.due_date || 'Due upon receipt'}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceUrl}" style="display: inline-block; background-color: #1a73e8; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
            View Invoice & Pay Online
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 25px;">
          You can also view and download your invoice directly by visiting:<br/>
          <a href="${invoiceUrl}" style="color: #1a73e8; word-break: break-all;">${invoiceUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          Thank you for choosing Urban Furniture.
        </p>
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
