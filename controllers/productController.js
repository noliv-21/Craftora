const Products = require('../models/productSchema')
const Categories = require('../models/categorySchema')
const multer = require('multer')
const path = require('path')

const storage= multer.diskStorage({
    destination:(req, file, cb)=>{
        cb(null, 'images/user/profiles')
    },
    filename:(req, file, cb)=>{
        console.log(file);
        cb(null, Date.now()+path.extname(file.originalname))
    }
})

exports.upload=multer({storage:storage})

exports.products = async (req, res) => {
    const products = await Products.find({}).populate('category','name')
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/product folder/product_list', {
        products, errorMessage, successMessage
    })
}

exports.addProductPage = async (req, res) => {
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    req.session.errorMessage = null
    req.session.successMessage = null
    const categories = await Categories.find({}, { name: 1})
    // const categories = (await Categories.find({}, { name: 1, _id: 0 })).map(category => category.name);
    const offerTypes = Products.schema.path('offerType').enumValues;
    const statuses = Products.schema.path('status').enumValues;
    res.render('admin/product folder/add_product', {
        successMessage, errorMessage, offerTypes, statuses, categories
    })
}

exports.addProduct = async (req, res) => {
    // console.log(req.body);
    const { name, description, price, mrp, offerType, offer, maxDiscount, category, stock, tags, status, isListed } = req.body;
    // const category=req.body.category
    try {
        console.log("category",category);
        // const catId = await Categories.findOne({ name: category }, { _id: 1 });
        // console.log("catId",catId);
        // if (!catId) throw new Error('Category not found');
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
        const productChk = await Products.findOne({ name })
        if (!productChk) {
            const newProduct = new Products({
                name, description, offerType, offer, isListed, status, maxDiscount, mrp, category,
                tags:tagsArray,
                sellingPrice: price,
                inventory: stock,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            })
            await newProduct.save()
            console.log("Product added successfully");
            req.session.successMessage = "Product added successfully"
            res.redirect('/admin/products')
        } else {
            console.log('Product with same name exists');
            req.session.errorMessage = 'A Product with same name exists'
            res.redirect('/admin/products/add')
        }
    } catch (error) {
        console.error("Error during product creation:", error);
        req.session.errorMessage = "Error saving product"
        res.redirect('/admin/products/add')
    }
}

exports.list_unlist=async (req,res)=>{
    const catId=req.body.id
    const isListed=req.body.isListed==='true'
    try {
        await Products.findByIdAndUpdate(catId, { isListed: isListed });
        req.session.successMessage='Successfully updated'
        res.redirect('/admin/products')
    } catch (error) {
        console.error(error);
        req.session.errorMessage='Not updated'
        res.redirect('/admin/products')
    }
}

exports.deleteProduct = async (req, res) => {
    const catId = req.query.id
    try {
        const result = await Products.findByIdAndDelete(catId);
        if (result) {
            req.session.successMessage = "Product deleted succesfully"
            res.redirect('/admin/products')
        } else {
            req.session.errorMessage = "Couldn't delete the product"
            res.redirect('/admin/products')
        }
    } catch (err) {
        console.error(err);
        req.session.errorMessage = "Couldn't delete the product"
        res.redirect('/admin/products')
    }
}

exports.editPage = async (req, res) => {
    const catId = req.query.id;
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(catId)
    req.session.errorMessage = null
    req.session.successMessage = null
    const categories = await Categories.find({}, { name: 1})
    const offerTypes = Products.schema.path('offerType').enumValues;
    const statuses = Products.schema.path('status').enumValues;
    res.render('admin/product folder/edit_product', {
        productDetails, successMessage, errorMessage, offerTypes, statuses, categories
    })
}

exports.edittingProduct = async (req, res) => {
    const { originalName,name, description, price, mrp, offerType, offer, maxDiscount, category, stock, tags, status, isListed } = req.body;
    try {
            await Products.findOneAndUpdate({ name: originalName}, {
            name, description, offerType, offer, isListed, status, maxDiscount, mrp, category,
            tags:tagsArray,
            sellingPrice: price,
            inventory: stock
        })
        console.log("Product edited successfully");
        req.session.successMessage = "Product Edited"
        res.redirect('/admin/products')
    } catch (error) {
        console.error("Error during editting product:", error);
        req.session.errorMessage = "Product with same name exists"
        res.redirect('/admin/products')
    }
}

exports.productDetails = async (req,res)=>{
    const id=req.query.id
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(id).populate('category','name')
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/product folder/product_details',{
        productDetails,errorMessage,successMessage
    })
}