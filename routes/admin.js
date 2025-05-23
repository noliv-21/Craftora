const express = require('express');
const admin = express.Router();

const productController = require('../controllers/productController');
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const userController = require('../controllers/userController');
const orderController = require('../controllers/orderController')
const couponController = require('../controllers/couponController')
const salesController = require('../controllers/salesController')

admin.use('/',express.static('public'));
// Authentication
admin.get('/login',adminController.login);
admin.post('/login', adminController.login_verify)

admin.get('/home', salesController.dashboard)
admin.get('/logout', adminController.logout)

admin.get('/users',userController.users)
admin.post('/blockUser',userController.block_unblock)
// Categories
admin.get('/categories',categoryController.categories)
admin.get('/categories/add',categoryController.addCategory)
admin.post('/categories/add',categoryController.addingCategory)
admin.get('/deleteCategory',categoryController.deleteCategory)
admin.get('/editCategory',categoryController.editPage)
admin.post('/editCategory',categoryController.edittingCategory)
admin.post('/listCategory',categoryController.list_unlist)
// Products
admin.get('/products',productController.products)
admin.get('/products/add',productController.addProductPage)
admin.post('/products/add',productController.addProduct)
admin.post('/listProduct',productController.list_unlist)
admin.get('/deleteProduct',productController.deleteProduct)
admin.get('/editProduct',productController.editPage)
admin.post('/editProduct',productController.edittingProduct)
admin.get('/viewProduct',productController.productDetails)
// Orders
admin.get('/orders',orderController.getOrdersAdmin)
admin.post('/cancelOrder/:orderId',orderController.cancelOrder)
admin.patch('/updateOrderStatus/:orderId',orderController.updateStatus)
admin.patch('/order/approveReturnRequest/:orderId',orderController.approveReturnRequest)
admin.patch('/order/rejectReturnRequest/:orderId',orderController.rejectReturnRequest)
// Coupon routes
admin.get('/coupons',couponController.couponsPage_admin)
admin.get('/coupons/check-code/:code', couponController.checkCouponCode)
admin.post('/coupons', couponController.addCoupon);
admin.patch('/coupons/:id', couponController.updateCoupon);
admin.patch('/coupons/:id/toggle', couponController.toggleCouponStatus)
// Sales reports
admin.get('/generate-sales-report', salesController.generateSalesReport);
admin.get('/download-sales-report', salesController.downloadSalesReport);
admin.get('/analytics/:period', salesController.getAnalyticsData);

module.exports = admin;