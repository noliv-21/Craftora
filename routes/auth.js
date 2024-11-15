const express = require('express');
const auth = express.Router();
const controllers = require('../controllers/userController');
const passport = require('passport');

//google authentication

auth.get('/auth/google',passport.authenticate('google',{scope:['profile','email'],prompt:"select_account"}));

auth.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/login'}),(req,res)=>{
    // Retrieve user information and isNewUser flag
    const { user, isNewUser } = req.user;
    req.session.user=user;
    res.redirect('/user/home')
})

module.exports=auth