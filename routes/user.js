const express = require('express');
const user = express.Router();
const userController = require('../controllers/userController');
const productController = require('../controllers/productController')
const addressController = require('../controllers/addressController')
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController')
const wishlistController = require('../controllers/wishlistController')
const couponController = require('../controllers/couponController')
const paymentController = require('../controllers/paymentController');
const walletController = require('../controllers/walletController');
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

user.get('/cart',userController.userAuth,cartController.getCart)
user.post('/addToCart',cartController.addToCart)
user.patch('/cart/update-quantity',cartController.updateQuantity)
user.delete('/cart/removeProduct',cartController.removeProduct)

user.get('/buyNow', userController.userAuth, orderController.buyNowCheckout)
user.get('/checkout', userController.userAuth, orderController.checkout)
user.post('/order/creation',orderController.orderCreation)
user.get('/orders',userController.userAuth,orderController.showOrdersUser)
user.get('/order/details/:orderId',userController.userAuth,orderController.orderDetailsUser)
user.get('/order/invoice/:orderId',userController.userAuth,orderController.downloadInvoice)
user.patch('/order/cancel/:orderId',userController.userAuth,orderController.cancelOrder)

user.get('/wishlist',userController.userAuth,wishlistController.getWishlistPage)
user.delete('/wishlist/remove',wishlistController.removeProduct)
user.post('/wishlist/add',wishlistController.addProduct)
user.get('/wishlist/check',userController.userAuth,wishlistController.checkWishlist)

user.get('/dashboard/coupons', userController.userAuth, couponController.getUserCoupons);
user.get('/coupons/available', userController.userAuth, couponController.getAvailableCoupons);
user.post('/applyCoupon', userController.userAuth, couponController.applyCoupon);
user.delete('/removeCoupon', userController.userAuth, couponController.removeCoupon);
user.get('/coupons/history', userController.userAuth, couponController.couponHistory);
user.post('/coupons/save', userController.userAuth, couponController.saveCouponUser);
user.get('/product/:productId/coupons', userController.userAuth, couponController.getProductDetailsCoupons);

user.post('/razorpay/order', userController.userAuth, paymentController.createRazorpayOrder)
user.post('/razorpay/verify', userController.userAuth, paymentController.verifyPayment);
// user.post('/razorpay/webhook', paymentController.handleWebhook);

user.get('/dashboard/wallet', userController.userAuth, walletController.walletPage);
user.post('/wallet/add-money', userController.userAuth, walletController.addMoneyToWallet);
user.get('/wallet/balance', userController.userAuth, walletController.getWalletBalance);

module.exports = user;