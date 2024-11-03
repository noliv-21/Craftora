const express = require('express');
const user = express.Router();
const userController = require('../controllers/userController');
const productController = require('../controllers/productController')
const passport = require('passport');

user.use('/',express.static('public'));

user.get('/login', userController.login);
user.post('/login', userController.login_verify)

user.post('/signUp', userController.signup_verify)
user.get('/otp', userController.otp)
user.post('/verify_otp',userController.verify_otp)
user.post('/otp_resend',userController.resend_otp)

user.get('/home', userController.home)
user.get('/logout', userController.logout)

user.get('/products',productController.showProducts)
user.get('/product/:productId',productController.productDetailsUser)

module.exports = user;