const admins = require('../models/adminSchema')
const users = require('../models/userSchema')
const bcrypt = require('bcrypt')

exports.login = async (req, res) => {
    if (req.session.passwordwrong) {
        req.session.passwordwrong = false;
        res.render('admin/login', { msg: "Invalid Credentials" });
    } else {
        res.render('admin/login')
    }
}

exports.login_verify = async (req, res) => {
    console.log(req.body);

    const UserName = req.body.username;
    const Password = req.body.password;

    try {
        const adminlogin = await admins.findOne({ username: UserName });
        if (adminlogin) {
            //const match = await bcrypt.compare(Password, adminlogin.password);
            if (adminlogin.password == Password) {
                req.session.admin = UserName;
                return res.redirect('/admin/home');
            } else {
                req.session.passwordwrong = true;
                return res.redirect('/admin/login');
            }
        } else {
            req.session.passwordwrong = true;
            return res.redirect('/admin/login');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};

// exports.home = (req, res) => {
//     res.render('admin/dashboard', {
//         activeTab: "dashboard"
//     });
// };

exports.logout = (req, res) => {
    delete req.session.admin;
    res.redirect('/admin/login');
}

exports.searchUsers = async (req, res) => {
    const searchQuery = req.query.query || '';
    // console.log(searchQuery);
    try {
        const result = await users.find({
            $or: [{ username: { $regex: searchQuery, $options: 'i' } }, { email: { $regex: searchQuery, $options: 'i' } }]
        }).lean();
        // console.log(result);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Couldn't retrieve user data from server" });
    }
}

exports.update_details = async (req, res) => {
    const originalUsername = req.body.original_username; // The original username from the form
    const newUsername = req.body.new_username; // The new username from the form
    const newEmail = req.body.new_email; // The new email from the form

    try {
        await users.findOneAndUpdate(
            { username: originalUsername },
            { username: newUsername, email: newEmail }
        );
        res.redirect('/admin/home');
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleting = async (req, res) => {
    const searchQuery = req.body.username;
    // if (typeof searchQuery !== 'string') {
    //     throw new Error('Invalid username: must be a string');
    // }
    try {
        const result = await users.findOneAndDelete({ username: searchQuery });
        console.log(result);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Couldn't delete from server" });
    }
}