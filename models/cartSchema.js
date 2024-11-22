const mongoose = require('mongoose')

const cartSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        unique:true
    },
    products:[
        {
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'product'
            },
            quantity:{
                type:Number,
                default:1
            }
        }
    ],
    totalAmount:{
        type:Number,
        default:0
    }
})

cartSchema.pre('save', async function (next) {
    if (!this.isModified('products')) return next(); // Skip if products haven't changed

    await this.populate({
        path: 'products.productId',
        populate: {
            path: 'category', // Populate category within product
            model: 'Category'
        }
    });

    // Calculate the total amount
    this.totalAmount = this.products.reduce((total, item) => {
        const product = item.productId;
        const category = product.category;

        const productPrice = product.mrp || 0; // Product's original price (MRP)
        
        // Product and category percentage-based discounts
        const productPercentageDiscount = product.offer || 0; // Product discount in percentage
        const categoryPercentageDiscount = category?.offer || 0; // Category discount in percentage

        // Calculate price after percentage discounts
        const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);

        // Round the discount amount first, then subtract from price
        const discountAmount = Math.round((productPrice * (percentageDiscount / 100)) * 100) / 100;
        // const priceAfterPercentageDiscount = productPrice - discountAmount;
        const priceAfterPercentageDiscount = Math.round((productPrice - discountAmount) * 100) / 100;

        // Fixed amount discounts
        const productFixedDiscount = product.fixedAmount || 0;
        const categoryFixedDiscount = category?.fixedAmount || 0;

        // Determine the best discount type
        const priceAfterFixedDiscount = Math.round(Math.max(productPrice - productFixedDiscount, productPrice - categoryFixedDiscount) * 100) / 100;
        const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
        // const priceAfterFixedDiscount = Math.max(productPrice - productFixedDiscount, productPrice - categoryFixedDiscount);
        // const finalDiscountedPrice = Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount);

        // // Ensure the final price is not negative
        // const effectivePrice = Math.max(0, finalDiscountedPrice);

        // Round to 2 decimal places to avoid floating point issues
        const effectivePrice = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;

        // Add to total considering quantity, rounding the multiplication result
        const itemTotal = Math.round((effectivePrice * item.quantity) * 100) / 100;
        return Math.round((total + itemTotal) * 100) / 100;
        // Add to total considering quantity
        // return Math.round((total + (effectivePrice * item.quantity)) * 100) / 100;
        // return total + (effectivePrice * item.quantity);
    }, 0);

    next();
});

// // Pre-save hook to calculate totalAmount
// cartSchema.pre('save', async function (next) {
//     if (!this.isModified('products')) return next(); // Skip if products haven't changed

//     // Populate products to access their prices
//     await this.populate('products.productId');

//     // Calculate the totalAmount based on product prices and quantities
//     this.totalAmount = this.products.reduce((total, item) => {
//         const productPrice = item.productId.price || 0; // Assume each product document has a `price` field
//         return total + productPrice * item.quantity;
//     }, 0);

//     next();
// });

const cartModel = mongoose.model('cart',cartSchema,'Carts')

module.exports = cartModel;