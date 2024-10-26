const users = require('../models/userSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // To generate OTP
const env = require('dotenv').config();

exports.login = async (req, res) => {

    if (req.session.user) {
        res.redirect('/user/home');
    } else {
        if (req.session.errorMsg) {
            res.render('user/login', { msg: "Invalid Credentials" });
            req.session.errorMsg = false;
        } else {
            res.render('user/login', { msg: "" })
        }
    }
}

exports.login_verify = async (req, res) => {
    console.log(req.body);

    const Cred = req.body.cred;
    const Password = req.body.password;

    try {
        const userCred = await users.findOne({ $or: [{ username: Cred }, { email: Cred }] });
        if (userCred) {
            const match = await bcrypt.compare(Password, userCred.password);
            const isVerified = userCred.isVerified
            const isGoogleUser= userCred.isGoogleUser
            const isBlocked= userCred.isBlocked
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

exports.home = (req, res) => {
    if (req.session.user) {
        res.render('user/home',{
            greetName:req.session.user
        });
    } else {
        res.render('user/home',{
            greetName:null
        })
    }
};

exports.logout = (req, res) => {
    delete req.session.user;
    res.redirect('/user/login');
}

exports.otp = async (req, res) => {
    const email = req.query.email;
    res.render('user/email_cfm.hbs', { email })
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

        const usernamechk = await users.findOne({ username: req.body.username });
        if (!usernamechk) {
            const newuser = new users({
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
                    // Optionally, you could log this error or retry sending the email
                });

            // Redirect to OTP page
            res.redirect(`/user/otp`);
        } else {
            res.redirect('/user/login'); // User already exists
        }

    } catch (err) {
        console.error("Error during sign up:", err);
        res.status(500).send("Server error");
    }
};

exports.verify_otp = async (req, res) => {
    try {
        // Check if OTP matches and hasn't expired
        if (req.session.userOtp === req.body.otp && req.session.otpExpires > Date.now()) {
            req.session.userOtp = null;
            req.session.otpExpires = null;

            // Verify user in database
            await users.findOneAndUpdate({ email: req.session.otp_cred }, { isVerified: true });
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

exports.google_login = async (req, res) => {
    const { email, displayName, isSignUp } = req.body;
    console.log(req.body);
    try {
        let user = await users.findOne({ email });
        if (!user && isSignUp) {
            user = new users({
                username: displayName,
                email,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                isGoogleUser: true
            });
            await user.save(); // Save new user
            console.log("New Google user saved");
        }
        req.session.user = user.username;
        return res.redirect('/user/home');
    } catch (err) {
        console.error("Error during Google login:", err);
        res.status(500).send("Server error");
    }
};

