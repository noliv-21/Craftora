const express = require('express')
const app = express();
const ejs=require('ejs')
const session = require('express-session');
const nocache = require('nocache');
const adminRoute = require('./routes/admin');
const userRoute = require('./routes/user');
const authRoute = require('./routes/auth');
const adminAuth=require('./routes/Authentication/adminAuth.js')
const bodyParser = require('body-parser');
const passport = require('./config/passport')
const expressLayouts=require('express-ejs-layouts')
const env = require('dotenv').config();
const { connectMongoDb } = require('./connection.js')

connectMongoDb(process.env.MONGODB_CONNECT)

app.set('view engine', 'ejs')
app.use(expressLayouts)
app.set('views', __dirname + '/views'); // Your views folder
app.set('layout', 'layouts/main'); // Your main layout file

app.use(bodyParser.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

app.use(session({
    secret: 'nllaho30750&*)(ohohidjojfoij098gertu',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 3 * 24 * 60 * 60 * 1000
    }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(nocache());

// Root route for landing page
app.get('/', (req, res) => {
    res.render('landing', { title: 'Welcome to Craftora' });
});

app.use('/admin', adminAuth, adminRoute)
app.use('/user', userRoute);
app.use('/', authRoute)

app.listen(4004, () => console.log("Server running on port 4004"))