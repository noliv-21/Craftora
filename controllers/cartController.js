const Carts = require('../models/cartSchema')
const Products = require('../models/productSchema')

exports.getCart = async (req, res) => {
    try {
        const session = req.session.user;
        const userId = session._id;

        const cart = await Carts.findOne({ userId }).populate({
            path: 'products.productId',
            // select: 'name mrp offer fixedAmount category',
            populate: { path: 'category'}
        });
        if(!cart){
            return res.render('user/cart/cart', {
                session,
                countOfProducts: 0,
                products:[]
            });
        }
        const products = cart ? cart.products.map(item => {
            const product = item.productId;

            // Calculate discounts using the same method as cartSchema
            const productPercentageDiscount = product.offer || 0;
            const categoryPercentageDiscount = product.category.offer || 0;
            const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);

            // Calculate price after percentage discounts
            const discountAmount = Math.round((product.mrp * (percentageDiscount / 100)) * 100) / 100;
            const priceAfterPercentageDiscount = Math.round((product.mrp - discountAmount) * 100) / 100;

            // Fixed amount discounts
            const productFixedDiscount = product.fixedAmount || 0;
            const categoryFixedDiscount = product.category.fixedAmount || 0;

            // Determine the best discount type and price
            const priceAfterFixedDiscount = Math.round(Math.max(product.mrp - productFixedDiscount, product.mrp - categoryFixedDiscount) * 100) / 100;
            const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
            const discountedPrice = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;

            let bestDiscountType = '';
            if (percentageDiscount > 0 && priceAfterPercentageDiscount <= priceAfterFixedDiscount) {
                bestDiscountType = `${percentageDiscount}% off`;
            } else if (productFixedDiscount > categoryFixedDiscount) {
                bestDiscountType = `₹${productFixedDiscount} off`;
            } else if (categoryPercentageDiscount > 0) {
                bestDiscountType = `Category Offer: ${categoryPercentageDiscount}% off`;
            }

            return {
                ...item.toObject(),
                discountedPrice,
                bestDiscountType
            };
        }) : [];
        
        const totalAmount = cart.totalAmount || 0; 
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
        const newQuantity = parseInt(req.body.quantity) || 1;

        const product = await Products.findById(productId);
        if (!product) {
            return res.status(404).json("Product not found");
        }
        const maxAllowedQuantity = Math.min(product.inventory, 5);

        let cart = await Carts.findOne({ userId });
        if (cart) {
            const productIndex = cart.products.findIndex(
                (item) => item.productId.toString() === productId
            );
            if (productIndex > -1) {
                const currentQuantity = cart.products[productIndex].quantity;
                const totalQuantity = currentQuantity + newQuantity;
                if (totalQuantity > maxAllowedQuantity) {
                    if (maxAllowedQuantity === 5) {
                        return res.status(400).json("Maximum limit of 5 items reached for this product");
                    } else {
                        return res.status(400).json(`Only ${maxAllowedQuantity} items available in stock`);
                    }
                }
                cart.products[productIndex].quantity = totalQuantity;
                await cart.save();
                return res.status(200).json("Product quantity updated in cart");
            } else {
                cart.products.push({ productId, quantity: newQuantity });
                await cart.save();
            }
        } else {
            cart = new Carts({
                userId,
                products: [{ productId, quantity: newQuantity }]
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
        // // Find the user's cart
        const cart = await Carts.findOne({ userId }).populate({
            path: 'products.productId',
            populate: { path: 'category' }
        });
        // const cart = await Carts.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the product in the cart and update the quantity
        const productIndex = cart.products.findIndex(item => item.productId._id.toString() === productId);
        if (productIndex > -1) {
            cart.products[productIndex].quantity += change;
            if (cart.products[productIndex].quantity < 1) cart.products[productIndex].quantity = 1; // Ensure quantity stays positive
            await cart.save();
            return res.json({
                success: true,
                products: cart.products,
                totalAmount: cart.totalAmount,
                message: 'Quantity updated successfully'
            });
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
