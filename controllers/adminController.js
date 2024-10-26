const admins = require('../models/adminSchema')
const users = require('../models/userSchema')
const bcrypt = require('bcrypt')

exports.login = async (req, res) => {
    console.log("working");

    if (req.session.admin) {
        res.redirect('/admin/home');
    } else {
        if (req.session.passwordwrong) {
            res.render('admin/login', { msg: "Invalid Credentials" });
            req.session.passwordwrong = false;
        } else {
            res.render('admin/login')
        }
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

exports.home = (req, res) => {
    res.render('admin/dashboard', {
        isSelected: "dashboard"
    });
    // if (req.session.admin) {
    //     res.render('admin/dashboard', {
    //         isSelected:"dashboard"
    //     });
    // } else {
    //     res.redirect('/admin/login')
    // }
};

exports.logout = (req, res) => {
    delete req.session.admin;
    res.redirect('/admin/login');
}

exports.users = async (req, res) => {
    if (req.session.admin) {
        try {
            // Fetching the users from the database
            const result = await users.find({}).lean();
            // Rendering the 'admin/users.hbs' page and passing the 'result' to the template
            console.log(result);
            res.render('admin/user folder/users', {
                users: result,
                isSelected: "customers"
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Error fetching users from the database" });
        }
    } else {
        res.redirect('/admin/login');
    }
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

exports.create_verify = async (req, res) => {
    //      Create new user
    console.log("Request body", req.body);
    try {
        const usernamechk = await users.findOne({ username: req.body.username });
        // const existchk = users.some((user) => user.username === req.body.username);
        if (!usernamechk) {

            // Check if the required fields are present
            if (!req.body.username || !req.body.password) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            const newuser = new users({
                username: req.body.username,
                password: await bcrypt.hash(req.body.password, 10),  // Hashing password for security
                email: req.body.email || undefined,
                gender: req.body.gender || undefined
            })
            await newuser.save();
            console.log("User created successfully");
            res.redirect('/admin/home?msg=User%20Created%20Successfully');
            // Send success response
            // res.status(200).json({ success: true, message: 'User Created Successfully' });
        } else {
            res.redirect('/admin/home?msg=Username%20Exists');
        }
    } catch (err) {
        console.error("Error during user creation:", err);
        res.status(500).json({ success: false, message: 'Error saving user' });
    }
}