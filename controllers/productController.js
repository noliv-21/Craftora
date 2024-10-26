const products=require('../models/productSchema')

exports.products=(req,res)=>{
    res.render('admin/product folder/product_list')
}