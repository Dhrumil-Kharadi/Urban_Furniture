const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { env } = require('./config/env');

// Middleware
const errorMiddleware = require('./middleware/error.middleware');
const notFoundMiddleware = require('./middleware/notFound.middleware');

// Feature routes
const authRoutes = require('./auth/auth.routes');
const organizationsRoutes = require('./organizations/organizations.routes');
const usersRoutes = require('./users/users.routes');
const accountsRoutes = require('./accounts/accounts.routes');
const journalsRoutes = require('./journals/journals.routes');
const journalEntriesRoutes = require('./journals/journalEntries.routes');
const taxesRoutes = require('./taxes/taxes.routes');
const analyticsRoutes = require('./analytics/analytics.routes');
const contactsRoutes = require('./contacts/contacts.routes');
const productsRoutes = require('./products/products.routes');
const productCategoriesRoutes = require('./product-categories/product-categories.routes');

// Uploaded files (contact profile images) live outside src/ and are served
// read-only from a fixed root. Filenames are random UUIDs chosen by the
// server, so a path is unguessable, and the extension is decided by the
// file's magic bytes rather than anything the uploader claimed.
const { UPLOAD_ROOT, PUBLIC_PREFIX } = require('./shared/fileStorage');

/**
 * Create and configure Express application.
 *
 * Middleware order:
 * 1. Security headers (Helmet)
 * 2. CORS
 * 3. Body parsing (JSON, URL-encoded)
 * 4. Cookie parsing
 * 5. Feature routes
 * 6. 404 handler
 * 7. Centralized error handler
 */
const app = express();

// ─── Security Headers ───────────────────────────────────
app.use(helmet());

// ─── CORS ───────────────────────────────────────────────
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ───────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Cookie Parsing ─────────────────────────────────────
app.use(cookieParser());

// ─── Health Check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// ─── Feature Routes ─────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/journals', journalsRoutes);
app.use('/api/journal-entries', journalEntriesRoutes);
app.use('/api/taxes', taxesRoutes);
app.use('/api/analytic-accounts', analyticsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/product-categories', productCategoriesRoutes);

// ─── Uploaded Files ─────────────────────────────────────
// `dotfiles: 'deny'` and an explicit Content-Type stop a stored file being
// served back as anything a browser would execute.
app.use(
  PUBLIC_PREFIX,
  express.static(UPLOAD_ROOT, {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    },
  })
);

// Future feature routes will be mounted here:
// app.use('/api/orders', orderRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/admin', adminRoutes);

// ─── 404 Handler (must be after all routes) ─────────────
app.use(notFoundMiddleware);

// ─── Error Handler (must be last) ───────────────────────
app.use(errorMiddleware);

module.exports = app;
