const express = require('express');
const admin = express.Router();
const productController = require('../controllers/productController');
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');

admin.use('/',express.static('public'));

admin.get('/login',adminController.login);
admin.post('/login', adminController.login_verify)

admin.get('/home', adminController.home)
admin.get('/logout', adminController.logout)

admin.get('/users',adminController.users)
admin.get('/search-users',adminController.searchUsers)

admin.get('/products',productController.products)

admin.get('/categories',categoryController.categories)
admin.get('/categories/add',categoryController.addCategory)
admin.post('/categories/add',categoryController.addingCategory)
admin.get('/deleteCategory',categoryController.deleteCategory)
admin.get('/editCategory',categoryController.editPage)
admin.post('/editCategory',categoryController.edittingCategory)
admin.post('/listCategory',categoryController.list_unlist)

// admin.post('/update',adminController.update_details)

// admin.post('/delete-user',adminController.deleting)

// admin.post('/create_verify',adminController.create_verify)

module.exports = admin;