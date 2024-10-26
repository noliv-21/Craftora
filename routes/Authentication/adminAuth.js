const express = require('express')
const adminAuth = express.Router();

adminAuth.use('/',express.static('public'));

adminAuth.use((req, res, next) => {
    if (req.path === '/login' || req.path.startsWith('/public')) {
        next();
    } else if (req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
})

module.exports = adminAuth;