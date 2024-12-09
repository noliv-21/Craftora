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
                req.session.user = userCred;
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

exports.forgotPasswordPage = async (req,res)=>{
    try {
        res.render('user/forgotPassword')
    } catch(err) {
        console.error(err)
    }
}

exports.sendOtp = async (req,res)=>{
    try {
        const {email} = req.body;
        const userExists = await Users.findOne({email})
        if(userExists){
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
                    res.status(200).json("OTP send successfully")
                })
                .catch((error) => {
                    console.error('Error sending OTP email:', error);
                    res.status(500).json("Error sending OTP")
                });
        }else {
            console.error("An account with this email doesn't exist")
            res.status(404).json("An account with this email doesn't exist")
        }
    } catch (error) {
        res.status(500).json("Server error")
        console.error(error)
    }
}

exports.home = async (req, res) => {
    try {
        const session = req.session.user
        const title = 'Craftora Home'
        const userGreet = req.session.user ? session.username || session.fullname : 'Guest';
        const products = await Products.find({isListed : true}).sort({ createdAt: -1 }).limit(5)
        const categories = await Categories.find({}).sort({ createdAt: -1 }).limit(5)
        res.render('user/home', {
            title, session:userGreet, products, categories,
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
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
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
                phone: req.body.phone
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
    if(req.body.isForgot){
        try {
            if (req.session.userOtp === req.body.otp && req.session.otpExpires > Date.now()) {
                req.session.userOtp = null;
                req.session.otpExpires = null;
                res.status(200).json("OTP verified")
            } else if (req.session.otpExpires < Date.now()) {
                res.status(400).json("Timer Expired")
            } else {
                alert('Invalid Otp')
                res.status(400).json("Invalid OTP")
            }
        } catch (error) {
            console.error(error);
            res.status(500).json("Server error");
        }
    }else {
        try {
            // Check if OTP matches and hasn't expired
            if (req.session.userOtp === req.body.otp && req.session.otpExpires > Date.now()) {
                req.session.userOtp = null;
                req.session.otpExpires = null;
    
                // Verify user in database
                await Users.findOneAndUpdate({ email: req.session.otp_cred }, { isVerified: true });
                res.redirect('/user/login');
            } else if (req.session.otpExpires < Date.now()) {
                res.status(400).json("Timer Expired")
            } else {
                alert('Invalid Otp')
                res.status(400).json("Invalid OTP")
            }
        } catch (err) {
            console.error("Error verifying OTP:", err);
            res.status(500).json("Server error");
        }
    }
};

exports.resend_otp = async (req, res) => {
    let email = req.session.otp_cred || req.body.email;

    // Initialize the count if not present
    if (!req.session.resendCount) {
        req.session.resendCount = 0;
    }

    // Check resend limit
    if (req.session.resendCount >= 2) {
        return res.status(405).json("Too many OTP resend attempts. Please try again later.");
    }

    // Increment the resend count before sending OTP
    req.session.resendCount += 1;

    // Generate OTP
    const otp = generateOTP();
    req.session.userOtp = otp;
    req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10-minute expiration
    console.log(`Generated OTP: ${otp}`);

    try {
        // Send the OTP email asynchronously
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log('OTP sent successfully');
            return res.status(200).json({
                message: "OTP sent successfully",
                redirect: req.session.otp_cred ? '/user/otp' : null
            });
        } else {
            throw new Error("Failed to send OTP");
        }
        // if (emailSent) {
        //     console.log('OTP sent successfully');
        //     if (req.session.otp_cred) {
        //         return res.redirect(`/user/otp`);
        //     } else {
        //         return res.status(200).json("OTP sent successfully");
        //     }
        // } else {
        //     // Respond with JSON directly if sending fails
        //     console.error("Failed to send OTP");
        //     return res.status(500).json("Failed to send OTP");
        // }
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return res.status(500).json("Error sending Email");
    }
};

exports.users = async (req, res) => {
    try {
        let search = req.query.search || '';
        const title = 'Customers'
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null
        const users = await Users.find({}).sort({ createdAt: 1 }).skip(skip).limit(limit)
        const totalUsers = await Users.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit)

        res.render('admin/user folder/users', {
            title, users, errorMessage, successMessage, page, limit, totalPages, totalUsers, activeTab: "customers"
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

exports.dashboard = async (req,res)=>{
    try {
        const session= req.session.user;
        const errorMessage = req.session.user.errorMess;
        const successMessage = req.session.user.successMess;
        const user = await Users.findOne({email:session.email})
        res.render('user/dashboard/profile',{
            session:session.email,user,errorMessage,successMessage,activeTab:'profile'
        })
    } catch (error) {
        console.error(error)
    }
}

exports.saveUserDetails = async (req,res)=>{
    const userDet = req.body;
    const session = req.session.user;
    try {
        const usernameChk = await Users.findOne({ username: userDet.username, email: { $ne: session.email } })
        if(!usernameChk){
            await Users.findOneAndUpdate({email:session.email},{
                username:userDet.username,
                fullname:userDet.fullname,
                gender:userDet.gender,
                phone:userDet.phone
            })
            res.status(200).json('Successfully updated');
        }else{
            req.session.user.errorMess = 'Username already exists'
            res.redirect(`/user/profile`)
            // return res.status(404).json({msg:'Username already exists'})
        }
    } catch (error) {
        console.log(error)
    }
}

exports.changePassword = async (req,res)=>{
    const session = req.session.user;
    if(session){
        try {
            const user = await Users.findOne({ email:session.email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            await Users.findOneAndUpdate({email:session.email},{password: await bcrypt.hash(req.body.password,10)})
            res.status(200).json('Password edited succesfully')
        } catch (error) {
            console.log(error)
        }
    }else{
        const { email, newPass } = req.body;
        try {
            await Users.findOneAndUpdate({email},{password: await bcrypt.hash(newPass,10)})
            res.status(200).json("Password changed successfully")
        } catch (error) {
            console.error(error)
            res.status(500).json("Couldn't change the password")
        }
    }
}