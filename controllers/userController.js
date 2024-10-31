const Users = require('../models/userSchema')
const Categories = require('../models/categorySchema')
const Products = require('../models/productSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // To generate OTP
const env = require('dotenv').config();

exports.userAuth = async (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/user/login')
    }
}

exports.login = async (req, res) => {

    if (req.session.user) {
        res.redirect('/user/home');
    } else {
        if (req.session.errorMsg) {
            req.session.errorMsg = false;
            res.render('user/login', { msg: "Invalid Credentials", signUp_msg: '' });
        } else if (req.session.signUp_msg) {
            const signUp_msg = req.session.signUp_msg
            req.session.signUp_msg = null;
            res.render('user/login', { signUp_msg, msg: '' })
        } else {
            res.render('user/login', { msg: '', signUp_msg: '' })
        }
    }
}

exports.login_verify = async (req, res) => {
    console.log(req.body);

    const Cred = req.body.cred;
    const Password = req.body.password;

    try {
        const userCred = await Users.findOne({ $or: [{ username: Cred }, { email: Cred }] });
        if (userCred) {
            const match = await bcrypt.compare(Password, userCred.password);
            const isVerified = userCred.isVerified
            const isGoogleUser = userCred.googleId
            const isBlocked = userCred.isBlocked
            if (match && (isVerified || isGoogleUser) && !isBlocked) {
                req.session.user = userCred.username;
                return res.redirect('/user/home');
            } else {
                req.session.errorMsg = true;
                return res.redirect('/user/login');
            }
        } else {
            req.session.errorMsg = true;
            return res.redirect('/user/login');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

exports.home = async (req, res) => {
    try {
        const title = 'Craftora Home'
        const products = await Products.find({}).sort({ createdAt: -1 }).limit(5)
        const categories = await Categories.find({}).sort({ createdAt: -1 }).limit(5)
        res.render('user/home', {
            title, greetName: req.session.user, products, categories,
        });
    } catch (error) {
        console.error(error)
    }
};

exports.logout = (req, res) => {
    delete req.session.user;
    res.redirect('/user/login');
}

exports.otp = async (req, res) => {
    const email = req.query.email;
    res.render('user/email_cfm', { email })
}

// Function to generate a random OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
}

async function sendVerificationEmail(email, otp) {
    try {
        // Configure Nodemailer for Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                // user: "craftora.noliv@gmail.com",
                // pass: "Craftora@123"
                user: process.env.EMAIL_USER, // Use environment variable
                pass: process.env.EMAIL_PASS  // Use environment variable
            },
            tls: {
                rejectUnauthorized: false  // Accept self-signed certificates
            }
        });
        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,     // Sender's email
            to: email,                        // Receiver's email
            subject: 'Your OTP Verification Code',
            text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
            html: `<br>Your OTP is ${otp}. It is valid for 10 minutes.</br>`
        };
        // Send email
        const info = await transporter.sendMail(mailOptions);
        if (info && info.response) {
            console.log("Email sent: ", info.response); // Logs the email sending status
            return true;  // Email sent successfully
        } else {
            console.error("Error: No response from email transporter");
            return false; // Failure in sending email
        }
    } catch (error) {
        console.error("Error sending the email", error)
        return false;
    }
}

exports.signup_verify = async (req, res) => {
    try {
        console.log(req.body);

        const usernamechk = await Users.findOne({ username: req.body.username });
        if (!usernamechk) {
            const newuser = new Users({
                username: req.body.username,
                password: await bcrypt.hash(req.body.password, 10),  // Hashing password for security
                email: req.body.email,
                phone: req.body.phone,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            });

            // Save the new user
            await newuser.save();
            console.log("User saved successfully");

            const email = req.body.email;

            // Generate OTP
            const otp = generateOTP();
            req.session.otp_cred = email;//Implement this later
            req.session.userOtp = otp;
            req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiration
            console.log(`Generated OTP: ${otp}`);

            // Then send the OTP email asynchronously
            sendVerificationEmail(email, otp)
                .then(() => {
                    console.log('OTP sent successfully');
                })
                .catch((error) => {
                    console.error('Error sending OTP email:', error);
                });

            // Redirect to OTP page
            res.redirect(`/user/otp`);
        } else {
            req.session.signUp_msg = "User already exists"
            console.error('user already exists');
            res.redirect('/user/login'); // User already exists
        }

    } catch (err) {
        console.error("Error during sign up:", err);
        req.session.signUp_msg = 'Email or username already exists'
        res.redirect('/user/login')
    }
};

exports.verify_otp = async (req, res) => {
    try {
        // Check if OTP matches and hasn't expired
        if (req.session.userOtp === req.body.otp && req.session.otpExpires > Date.now()) {
            req.session.userOtp = null;
            req.session.otpExpires = null;

            // Verify user in database
            await Users.findOneAndUpdate({ email: req.session.otp_cred }, { isVerified: true });
            res.redirect('/user/login');
        } else if (req.session.otpExpires < Date.now()) {
            alert('OTP Expired')
        } else {
            alert('Invalid Otp')
            res.status(400)
        }
    } catch (err) {
        console.error("Error verifying OTP:", err);
        res.status(500).send("Server error");
    }
};

exports.resend_otp = async (req, res) => {
    const email = req.session.otp_cred;

    // Initialize the count if not present
    if (!req.session.resendCount) {
        req.session.resendCount = 0;
    }
    if (req.session.resendCount > 2) {
        return res.status(429).json("Too many OTP resend attempts. Please try again later.")
    }

    // Generate OTP
    const otp = generateOTP();
    req.session.userOtp = otp;
    req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiration
    console.log(`Generated OTP: ${otp}`);

    // Then send the OTP email asynchronously
    sendVerificationEmail(email, otp)
        .then(() => {
            console.log('OTP sent successfully');
        })
        .catch((error) => {
            console.error('Error sending OTP email:', error);
            // Optionally, you could log this error or retry sending the email
        });

    // // Send verification email
    // const emailSent = /*await*/ sendVerificationEmail(email, otp);
    // if (!emailSent) {
    //     return res.json("email-error"); // Respond with error if email failed
    // }

    // Increment the resend count
    req.session.resendCount += 1;

    // Redirect to OTP page
    res.redirect(`/user/otp`);
}

exports.users = async (req, res) => {
    try {
        let search = req.query.search || '';

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null
        const users = await Users.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalUsers = await Users.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit)
        const reversedUser = users.reverse();

        res.render('admin/user folder/users', {
            title, users: reversedUser, errorMessage, successMessage, page, limit, totalPages, totalUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500)
    }
}

exports.block_unblock = async (req, res) => {
    const Id = req.body.id
    const isBlocked = req.body.isBlocked === 'true'
    try {
        await Users.findByIdAndUpdate(Id, { isBlocked: isBlocked });
        // req.session.successMessage='Successfully updated'
        res.redirect('/admin/users')
    } catch (error) {
        console.error(error);
        // req.session.errorMessage='Not updated'
        res.redirect('/admin/users')
    }
}

