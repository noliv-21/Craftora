const express = require('express');
const user = express.Router();
const controllers = require('../controllers/userController');
const passport = require('passport');

user.use('/',express.static('public'));

user.get('/login', controllers.login);

user.post('/login', controllers.login_verify)

user.get('/home', controllers.home)

user.get('/logout', controllers.logout)

user.post('/signUp', controllers.signup_verify)

user.get('/otp', controllers.otp)

user.post('/verify_otp',controllers.verify_otp)

user.post('/otp_resend',controllers.resend_otp)

module.exports = user;