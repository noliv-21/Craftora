const mongoose = require('mongoose')

const wishlistSchema = new mongoose.Schema({
    productId:{
        type: mongoose.Schema.Types.ObjectId,
        required:true,
        ref:"product"
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        required:true,
        ref:"user"
    }
},{timestamps:true})

const wishlistModel = mongoose.model("wishlist",wishlistSchema,"Wishlists")
module.exports = wishlistModel;