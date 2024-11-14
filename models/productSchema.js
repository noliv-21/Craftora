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
    tags:{
        type:Array,
        required:false,
    },
    mrp: {
        type: Number,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    },
    offerType:{
        type:String,
        required:false,
        enum:["Percentage","Fixed","BOGO","Free Shipping"]
    },
    offer: {
        type: Number,
        required: false,
        default: 0
    },
    maxDiscount: {
        type: Number,
        required: false
    },
    fixedAmount:{
        type:Number,
        required:false,
        default:0
    },
    image: {
        type: [String],
        // required: true
    },
    isListed: {
        type: Boolean,
        default: false
    },
    inventory:{
        type:Number,
        required:true,
        default:0
    },
    isAvailable: {
        type: String,
        enum: ["Available", "Out of Stock", "Only Few Left"],
        required: true,
        default: "Available"
    },
    rating:{
        type:Number,
        required:false,
        default:0
    }
},{timestamps:true})

const Product = mongoose.model("product", productSchema)
module.exports = Product