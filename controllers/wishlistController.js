const Wishlists = require('../models/wishlistSchema')

exports.getWishlistPage = async (req,res)=>{
    try {
        const session = req.session.user;
        const userId = session._id;
        const title = "Wishlist"
        const wishlist = await Wishlists.find({userId}).populate('productId').sort({createdAt:-1}) || []
        res.render('user/wishlist/wishlist',{ wishlist, title, session: session? session.username || session.fullname : null  })
    } catch (error) {
        console.error(error)
        res.status(500).json("Unable to render the page")
    }
}

exports.removeProduct = async (req,res)=>{
    try {
        const { productId } = req.query; // Extract from query parameters
        if (!productId) {
            return res.status(400).json("Invalid request");
        }
        const userId = req.session.user._id
        await Wishlists.findOneAndDelete({productId,userId});
        res.status(200).json("Removed from wishlist");
    } catch (err) {
        console.error(err);
        res.status(500).json("Error removing product");
    }
}

exports.addProduct = async (req,res)=>{
    try {
        const productId = req.body.productId;
        const userId = req.session.user._id;

        const exists = await Wishlists.findOne({ userId, productId });
        if (exists) {
            return res.status(400).json("Product is already in the wishlist");
        }

        const newWish = new Wishlists({ productId, userId })
        await newWish.save();
        console.log("Added to wishlist")
        res.status(200).json("Added to wishlist")
    } catch (error) {
        console.error(error)
        res.status(500).json("Error adding to wishlist")
    }
}

exports.checkWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const wishlistItems = await Wishlists.find({ userId }).select('productId');
        res.status(200).json(wishlistItems);
    } catch (error) {
        console.error(error);
        res.status(500).json("Error checking wishlist status");
    }
}