const categories = require('../models/categorySchema')

exports.categories = async (req, res) => {
    res.render('admin/category folder/category_list')
}

exports.addCategory = (req, res) => {
    res.render('admin/category folder/add_category')
}