const Carts = require('../models/cartSchema')
const Products = require('../models/productSchema')

exports.getCart = async (req, res) => {
    try {
        const session = req.session.user;
        const userId = session._id;

        const cart = await Carts.findOne({ userId }).populate({
            path: 'products.productId',
            // select: 'name mrp offer fixedAmount category',
            populate: { path: 'category', select: 'offer' }
        });

        const products = cart ? cart.products.map(item => {
            const product = item.productId;

            // Calculate discounts
            const percentageDiscountFromProduct = product.offer ? Math.floor(product.mrp * (product.offer / 100)) : 0;
            const fixedDiscountFromProduct = product.fixedAmount || 0;
            const categoryDiscount = product.category.offer
                ? Math.floor(product.mrp * (product.category.offer / 100))
                : 0;

            // Determine the best price
            let discountedPrice = product.mrp;
            let bestDiscountType = '';

            if (percentageDiscountFromProduct > fixedDiscountFromProduct && percentageDiscountFromProduct > categoryDiscount) {
                discountedPrice = product.mrp - percentageDiscountFromProduct;
                bestDiscountType = `${product.offer}% off`;
            } else if (fixedDiscountFromProduct > categoryDiscount) {
                discountedPrice = product.mrp - fixedDiscountFromProduct;
                bestDiscountType = `₹${fixedDiscountFromProduct} off`;
            } else if (categoryDiscount > 0) {
                discountedPrice = product.mrp - categoryDiscount;
                bestDiscountType = `Category Offer: ${product.category.offer}% off`;
            }

            return {
                ...item.toObject(),
                discountedPrice,
                bestDiscountType
            };
        }) : [];

        // const total = products.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
        // const totalAmount = products.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
        const totalAmount = cart.totalAmount; 
        const countOfProducts = products.length;

        res.render('user/cart/cart', {
            totalAmount,
            products,
            session,
            countOfProducts
        });
    } catch (error) {
        console.error(error);
    }
};

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
            return res.json({
                success: true,
                totalAmount: cart.totalAmount});
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
        const productId = req.body.productId;
        const updatedCart = await Carts.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        ).populate({
            path: 'products.productId',
            populate: { path: 'category', select: 'offer' }
        });
        if (updatedCart) {
            // Calculate new totals after product removal
            const products = updatedCart.products.map(item => {
                const product = item.productId;
                const percentageDiscountFromProduct = product.offer ? Math.floor(product.mrp * (product.offer / 100)) : 0;
                const fixedDiscountFromProduct = product.fixedAmount || 0;
                const categoryDiscount = product.category.offer ? Math.floor(product.mrp * (product.category.offer / 100)) : 0;

                let discountedPrice = product.mrp;
                let bestDiscountType = '';

                if (percentageDiscountFromProduct > fixedDiscountFromProduct && percentageDiscountFromProduct > categoryDiscount) {
                    discountedPrice = product.mrp - percentageDiscountFromProduct;
                    bestDiscountType = `${product.offer}% off`;
                } else if (fixedDiscountFromProduct > categoryDiscount) {
                    discountedPrice = product.mrp - fixedDiscountFromProduct;
                    bestDiscountType = `₹${fixedDiscountFromProduct} off`;
                } else if (categoryDiscount > 0) {
                    discountedPrice = product.mrp - categoryDiscount;
                    bestDiscountType = `Category Offer: ${product.category.offer}% off`;
                }

                return {
                    ...item.toObject(),
                    discountedPrice,
                    bestDiscountType
                };
            });

            // Calculate new total amount
            const totalAmount = products.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            // Update the cart with new total
            updatedCart.totalAmount = totalAmount;
            await updatedCart.save();

            // Send response with updated data
            res.status(200).json({
                success: true,
                message: 'Product removed from cart',
                totalAmount,
                products: products.map(p => ({
                    quantity: p.quantity,
                    productId: {
                        name: p.productId.name
                    }
                }))
            });
        } else {
            res.status(404).json({ success: false, message: 'Cart not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error removing product from cart' });
    }
};
