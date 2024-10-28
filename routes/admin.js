const express = require('express');
const admin = express.Router();
const productController = require('../controllers/productController');
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const userController = require('../controllers/userController')

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
admin.post('/products/add',productController.addProduct)
admin.post('/listProduct',productController.list_unlist)
admin.get('/deleteProduct',productController.deleteProduct)
admin.get('/editProduct',productController.editPage)
admin.post('/editProduct',productController.edittingProduct)
admin.get('/viewProduct',productController.productDetails)

// admin.post('/products/add-image',productController.upload.single('image'))

// admin.post('/update',adminController.update_details)

// admin.post('/delete-user',adminController.deleting)

// admin.post('/create_verify',adminController.create_verify)

module.exports = admin;