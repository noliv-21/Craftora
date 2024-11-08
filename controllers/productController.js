const Products = require('../models/productSchema')
const Categories = require('../models/categorySchema')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs').promises;


exports.products = async (req, res) => {
    try {
        let search = req.query.search || '';

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const products = await Products.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category', 'name')
        const totalProducts = await Products.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit)
        const reversedProduct = products.reverse();

        // const products = await Products.find({})
        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null
        res.render('admin/product folder/product_list', {
            products: reversedProduct, errorMessage, successMessage, page, totalPages, limit, totalProducts
        })
    } catch (error) {
        console.error(error)
    }
}

exports.addProductPage = async (req, res) => {
    try {
        //error message handling
        const errorMessage = req.session.errorMessage
        const successMessage = req.session.successMessage
        req.session.errorMessage = null
        req.session.successMessage = null


        //product data handling
        const categories = await Categories.find({}, { name: 1 })
        // const categories = (await Categories.find({}, { name: 1, _id: 0 })).map(category => category.name);
        const offerTypes = Products.schema.path('offerType').enumValues;
        const statuses = Products.schema.path('status').enumValues;
        res.render('admin/product folder/add_product', {
            successMessage, errorMessage, offerTypes, statuses, categories
        })
    } catch (error) {

    }
}

exports.addProduct = async (req, res) => {
    const { name, description, price, mrp, offerType, offer, maxDiscount, category, stock, tags, status, isListed } = req.body;
    try {
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
        const productChk = await Products.findOne({ name: new RegExp(`^${name}$`, 'i') })
        if (!productChk) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
                    images.push(req.files[i].filename);
                }
            }

            const newProduct = new Products({
                name, description, offerType, offer, isListed, status, maxDiscount, mrp, category,
                tags: tagsArray,
                sellingPrice: price,
                inventory: stock,
                image: images,
                createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            })
            await newProduct.save()
            console.log("Product added successfully");
            req.session.successMessage = "Product added successfully"
            res.status(200).json("successful").redirect('/admin/products')
            // res.redirect('/admin/products')
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

exports.list_unlist = async (req, res) => {
    const catId = req.body.id
    const isListed = req.body.isListed === 'true'
    try {
        await Products.findByIdAndUpdate(catId, { isListed: isListed });
        req.session.successMessage = 'Successfully updated'
        res.redirect('/admin/products')
    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Not updated'
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
    const categories = await Categories.find({}, { name: 1 })
    const offerTypes = Products.schema.path('offerType').enumValues;
    const isAvailable = Products.schema.path('isAvailable').enumValues;
    res.render('admin/product folder/edit_product', {
        productDetails, successMessage, errorMessage, offerTypes, isAvailable, categories
    })
}

exports.edittingProduct = async (req, res) => {
    const { originalName, name, description, price, mrp, offerType, offer, maxDiscount, category, stock, tags, isAvailable, isListed, removedImages } = req.body;
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    // console.log(req.body.images);
    try {
        // Fetch the product first
        const product = await Products.findOne({ name: originalName.trim() });
        if (!product) {
            req.session.errorMessage = "Product not found";
            return res.redirect('/admin/products');
        }
        async function saveBase64Image(base64String, filename) {
            const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(`public/uploads/product-images/${filename}`, buffer);
        }
        const { images } = req.body; // This should match the hidden input name

        try {
            if (images && Array.isArray(images)) {
                for (const [index, base64Image] of images.entries()) {
                    const filename = `product_${Date.now()}_${index}.png`;
                    await saveBase64Image(base64Image, filename);
                    product.image.push(filename);
                }
            }
        } catch (saveError) {
            console.error('Error saving base64 image:', saveError);
            req.session.errorMessage = "Error while saving base64 images";
            return res.redirect('/admin/products');
        }
        
        
        // Check for new file uploads
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                try {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    
                    // Resize the image using sharp
                    await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);
                    
                    // Add the new image filename to the images array
                    product.image.push(req.files[i].filename);
                } catch (imgError) {
                    console.error(`Error processing image ${req.files[i].filename}:`, imgError);
                    req.session.errorMessage = "Error while processing one or more images";
                    return res.redirect('/admin/products');
                }
            }
        }

        // if (removedImages) {
        //     const imagesToRemove = Array.isArray(removedImages) ? removedImages : [removedImages];
        //     imagesToRemove.forEach((img) => {
        //         const index = product.image.indexOf(img);
        //         if (index > -1) {
        //             product.image.splice(index, 1); // Remove from images array
        //             // Delete the file from the filesystem
        //             fs.unlink(path.join('public', 'uploads', 'product-images', img), (err) => {
        //                 if (err) {
        //                     console.error(`Error deleting image ${img}:`, err);
        //                 } else {
        //                     console.log(`Deleted image: ${img}`);
        //                 }
        //             });
        //         }
        //     });
        // }

        if (removedImages) {
            const imagesToRemove = Array.isArray(removedImages) ? removedImages : [removedImages];
            for (const img of imagesToRemove) {
                const index = product.image.indexOf(img);
                if (index > -1) {
                    product.image.splice(index, 1); // Remove from images array
                    
                    // Construct the full path to the image
                    const imagePath = path.join('public', 'uploads', 'product-images', img);
                    
                    // Check if the file exists before trying to delete it
                    try {
                        await fs.access(imagePath); // Check if the file exists
                        await fs.unlink(imagePath); // Delete the file
                        console.log(`Deleted image: ${img}`);
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            console.log(`Image not found, skipping deletion: ${img}`);
                        } else {
                            console.error(`Error deleting image ${img}:`, err);
                        }
                    }
                }
            }
        }
        await Products.findOneAndUpdate({ name: originalName }, {
            name, description, offerType, offer, isListed, isAvailable, maxDiscount, mrp, category,
            tags: tagsArray,
            sellingPrice: price,
            inventory: stock,
            image:product.image
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

exports.productDetails = async (req, res) => {
    const id = req.query.id
    const errorMessage = req.session.errorMessage
    const successMessage = req.session.successMessage
    const productDetails = await Products.findById(id).populate('category', 'name')
    req.session.errorMessage = null
    req.session.successMessage = null
    res.render('admin/product folder/product_details', {
        productDetails, errorMessage, successMessage
    })
}

exports.productDetailsUser = async (req, res) => {
    try {
        const productId = req.params.productId;
        const deliveryDate = new Date(new Date().setDate(new Date().getDate() + 5))
            .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const productDetails = await Products.findById(productId).populate('category', 'name');
        const relatedProducts = await Products.find({
            category:productDetails.category._id,
            _id: { $ne: productId }
        }).sort({createdAt:-1}).limit(10)
        const title = productDetails.name
        const session = req.session.user || null;
        res.render('user/product folder/product', {
            title, session, product: productDetails, deliveryDate, relatedProducts
        })
    } catch (error) {
        console.error(error)
    }
}

exports.showProducts = async (req,res)=>{
    try {
        let search = req.query.search || '';
        const session = req.session.user;
        const title = "All products";
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const products = await Products.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category', 'name')
        const totalProducts = await Products.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit)
        const reversedProduct = products.reverse();
        res.render('user/product folder/products',{
            title, session:session.username, limit, products, totalProducts, totalPages, page
        })
    } catch (error) {
        console.log(error)
    }
}