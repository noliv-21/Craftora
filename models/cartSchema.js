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

// Pre-save hook to calculate totalAmount
cartSchema.pre('save', async function (next) {
    if (!this.isModified('products')) return next(); // Skip if products haven't changed

    // Populate products to access their prices
    await this.populate('products.productId');

    // Calculate the totalAmount based on product prices and quantities
    this.totalAmount = this.products.reduce((total, item) => {
        const productPrice = item.productId.price || 0; // Assume each product document has a `price` field
        return total + productPrice * item.quantity;
    }, 0);

    next();
});

const cartModel = mongoose.model('cart',cartSchema,'Carts')

module.exports = cartModel;