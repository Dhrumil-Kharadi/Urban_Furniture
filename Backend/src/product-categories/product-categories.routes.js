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

router.get('/', authMiddleware.authorize('business_owner', 'accountant'), productCategoriesController.listCategories);
router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), productCategoriesController.getCategory);

router.post('/', authMiddleware.authorize('business_owner', 'accountant'), productCategoriesController.createCategory);

router.patch('/:id', authMiddleware.authorize('business_owner'), productCategoriesController.updateCategory);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), productCategoriesController.archiveCategory);
router.patch('/:id/unarchive', authMiddleware.authorize('business_owner'), productCategoriesController.unarchiveCategory);

module.exports = router;
