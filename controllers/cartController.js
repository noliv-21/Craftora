const Carts = require('../models/cartSchema')
const Products = require('../models/productSchema')

exports.getCart = async (req,res)=>{
    try {
        const session = req.session.user;
        const userId = session._id
        const cart = await Carts.findOne({userId}).populate('products.productId');
        const products = cart ? cart.products : [];
        const total = cart ? cart.totalAmount : 0;
        countOfProducts = products.length
        res.render('user/cart/cart',{
            total,products,session, countOfProducts
        })
    } catch (error) {
        console.error(error)
    }
}

exports.addToCart = async (req,res)=>{
    try {
        const userId = req.session.user._id
        const productId = req.body.productId;
        let cart = await Carts.findOne({ userId });
        if (cart) {
            const productIndex = cart.products.findIndex(
                (item) => item.productId.toString() === productId
            );
            if (productIndex > -1) {
                cart.products[productIndex].quantity += 1;
            } else {
                cart.products.push({ productId, quantity: 1 });
            }
            await cart.save();
        } else {
            cart = new Carts({
                userId,
                products: [{ productId, quantity: 1 }]
            });
            await cart.save();
        }

        res.status(200).json("Added to cart");
    } catch (error) {
        console.error(error)
        res.status(500).json("Something went wrong");
    }
}

exports.updateQuantity = async (req, res) => {
    const { productId, change } = req.body;
    const userId = req.session.user._id;

    try {
        // Find the user's cart
        const cart = await Carts.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the product in the cart and update the quantity
        const productIndex = cart.products.findIndex(item => item.productId.toString() === productId);
        if (productIndex > -1) {
            cart.products[productIndex].quantity += change;
            if (cart.products[productIndex].quantity < 1) cart.products[productIndex].quantity = 1; // Ensure quantity stays positive
            await cart.save();
            return res.json({ success: true });
        } else {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating quantity' });
    }
};

// In your controller file
exports.removeProduct = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.body.id;
        const result = await Carts.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } }
        );
        if (result) {
            res.status(200).json({ success: true, message: 'Product removed from cart' });
        } else {
            res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error removing product from cart' });
    }
};
