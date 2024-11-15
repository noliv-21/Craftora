const express = require('express');
const user = express.Router();
const userController = require('../controllers/userController');
const productController = require('../controllers/productController')
const addressController = require('../controllers/addressController')
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController')
const passport = require('passport');

user.use('/',express.static('public'));

user.get('/login', userController.login);
user.post('/login', userController.login_verify)
user.get('/forgotPassword',userController.forgotPasswordPage)
user.post('/sendOtp',userController.sendOtp)

user.post('/signUp', userController.signup_verify)
user.get('/otp', userController.otp)
user.post('/verify_otp',userController.verify_otp)
user.post('/otp_resend',userController.resend_otp)

user.get('/home', userController.home)
user.get('/logout', userController.logout)

user.get('/products',productController.showProductsPage)
user.get('/api/products', productController.fetchProducts);
user.get('/product/:productId',productController.productDetailsUser)

user.get('/profile',userController.userAuth,userController.dashboard)
user.post('/dash/saveUserDetails',userController.saveUserDetails)
user.post('/changePassword',userController.changePassword)

user.get('/addresses',userController.userAuth,addressController.showUserAddresses)
user.post('/addAddress',addressController.addAddress)
user.delete('/deleteAddress',addressController.deleteAddress)
user.patch('/user/editAddress/:addressId',addressController.editAddress)

user.get('/cart',userController.userAuth,cartController.getCart)
user.post('/addToCart',cartController.addToCart)
user.patch('/cart/update-quantity',cartController.updateQuantity)
user.delete('/cart/removeProduct',cartController.removeProduct)

user.get('/order/addressPage',userController.userAuth,addressController.getAddressPage)
user.get('/order/dispatch',userController.userAuth,orderController.cfmPage)
user.get('/order/payment',userController.userAuth,orderController.paymentPage)
user.post('/order/creation',orderController.orderCreation)
user.get('/orders',userController.userAuth,orderController.showOrdersUser)
user.patch('/order/cancel/:orderId',orderController.cancelOrder)

module.exports = user;