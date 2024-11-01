const Categories = require('../models/categorySchema')

exports.categories = async (req, res) => {
    try {
        let search = req.query.search || '';

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const categories = await Categories.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalCategories = await Categories.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit)
        const reversedCategory = categories.reverse();

        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null
        res.render('admin/category folder/category_list', {
            categories: reversedCategory, errorMessage, successMessage, page, totalPages, limit, totalCategories
        })
    } catch (error) {
        console.error(error)
    }
}

exports.addCategory = (req, res) => {
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/category folder/add_category', {
        successMessage, errorMessage
    })
}

exports.addingCategory = async (req, res) => {
    const name = req.body.category_name
    const description = req.body.description
    const isListed = req.body.status
    try {
        const catCheck = await Categories.findOne({ name: new RegExp(`^${name}$`, 'i') })
        if (!catCheck) {
            const newCategory = new Categories({
                name,
                description: description || "No Description",
                isListed: isListed,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            })
            await newCategory.save();
            console.log("Category created successfully");
            req.session.successMessage = "Category added successfully"
            res.redirect('/admin/categories')
        } else {
            req.session.errorMessage = "Category with same name already exists"
            res.redirect('/admin/categories/add')
        }
    } catch (error) {
        console.error("Error during user creation:", error);
        req.session.errorMessage = "Category with same name already exists"
        res.redirect('/admin/categories/add')
    }
}

exports.list_unlist = async (req, res) => {
    const catId = req.body.id
    const isListed = req.body.isListed === 'true'
    try {
        await Categories.findByIdAndUpdate(catId, { isListed: isListed });
        req.session.successMessage = 'Successfully updated'
        res.redirect('/admin/categories')
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Not updated'
        res.redirect('/admin/categories')
    }
}

exports.editPage = async (req, res) => {
    const catId = req.query.id;
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const catDetails = await Categories.findById(catId)
    const name = catDetails.name
    const description = catDetails.description
    const isListed = catDetails.isListed
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/category folder/edit_category', {
        name, description, isListed, successMessage, errorMessage
    })
}

exports.edittingCategory = async (req, res) => {
    const original_catName = req.body.category_name_original
    const name = req.body.category_name
    const description = req.body.description
    const isListed = req.body.status
    try {
        const catCheck = await Categories.findOneAndUpdate({ name: original_catName }, {
            name: name,
            description: description || "No Description",
            isListed: isListed
        })
        console.log("Category created successfully");
        req.session.successMessage = "Category Edited"
        res.redirect('/admin/categories')
    } catch (error) {
        console.error("Error during user creation:", error);
        req.session.errorMessage = "Category with same name exists"
        res.redirect('/admin/categories')
    }
}

exports.deleteCategory = async (req, res) => {
    const catId = req.query.id
    try {
        const result = await Categories.findByIdAndDelete(catId);
        if (result) {
            req.session.successMessage = "Category deleted succesfully"
            res.redirect('/admin/categories')
        } else {
            req.session.errorMessage = "Couldn't delete the category"
            res.redirect('/admin/categories')
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Couldn't delete from server" });
    }
}