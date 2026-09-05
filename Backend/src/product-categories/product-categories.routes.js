const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const productCategoriesController = require('./product-categories.controller');

const router = express.Router();

/**
 * Product Categories Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Categories are product master data, so they follow the same permission split
 * as products: both roles create, only the business owner modifies or archives
 * (project.md §3 as finalised by §10 Decision 1).
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), productCategoriesController.listCategories);
router.get('/:id', authMiddleware.authorize('admin', 'manager'), productCategoriesController.getCategory);

router.post('/', authMiddleware.authorize('admin', 'manager'), productCategoriesController.createCategory);

router.patch('/:id', authMiddleware.authorize('admin'), productCategoriesController.updateCategory);
router.patch('/:id/archive', authMiddleware.authorize('admin'), productCategoriesController.archiveCategory);
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), productCategoriesController.unarchiveCategory);

module.exports = router;
