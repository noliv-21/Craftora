const express = require('express');
const admin = express.Router();
const multer=require('multer')
const storage=require('../helpers/multer')
const uploads=multer({storage:storage});
const productController = require('../controllers/productController');
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const userController = require('../controllers/userController');
const orderController = require('../controllers/orderController')

admin.use('/',express.static('public'));

admin.get('/login',adminController.login);
admin.post('/login', adminController.login_verify)

admin.get('/home', adminController.home)
admin.get('/logout', adminController.logout)

admin.get('/users',userController.users)
admin.post('/blockUser',userController.block_unblock)
// admin.get('/search-users',adminController.searchUsers)

admin.get('/categories',categoryController.categories)
admin.get('/categories/add',categoryController.addCategory)
admin.post('/categories/add',categoryController.addingCategory)
admin.get('/deleteCategory',categoryController.deleteCategory)
admin.get('/editCategory',categoryController.editPage)
admin.post('/editCategory',categoryController.edittingCategory)
admin.post('/listCategory',categoryController.list_unlist)

admin.get('/products',productController.products)
admin.get('/products/add',productController.addProductPage)
admin.post('/products/add',uploads.array('images',5),productController.addProduct)
admin.post('/listProduct',productController.list_unlist)
admin.get('/deleteProduct',productController.deleteProduct)
admin.get('/editProduct',productController.editPage)
admin.post('/editProduct',uploads.array('images',10),productController.edittingProduct)
admin.get('/viewProduct',productController.productDetails)

admin.get('/orders',orderController.getOrdersAdmin)
admin.post('/cancelOrder/:orderID',orderController.cancelOrder)
admin.patch('/updateOrderStatus/:orderId',orderController.updateStatus)

// admin.post('/products/add-image',productController.upload.single('image'))

module.exports = admin;