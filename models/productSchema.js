const mongoose = require('mongoose')
//product Schema
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    mrp: {
        required: true,
        type: Number
    },
    sellingPrice: {
        type: Number,
        required: true
    },
    offer: {
        type: Number,
        required: false,
        default: 0
    },
    image: {
        type: [String],
        required: true
    },
    isListed: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of Stock", "Discontinued"],
        required: true,
        default: "Available"
    },
    rating:{
        type:Number,
        required:false,
        default:0
    }

}, { timestamps: true })

const Product = mongoose.model("product", productSchema)
module.exports = Product