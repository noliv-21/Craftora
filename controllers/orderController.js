const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')
const { products } = require('./productController')

exports.buyNowCheckout = async (req,res)=>{
    const session = req.session.user;
    const userId = session._id;
    try {
        const productId = req.query.productId;
        const quantity = parseInt(req.query.quantity);
        const product = await Products.findById(productId).populate('category');
        const totalMRP = product.mrp*quantity;

        // Percentage discounts
        const productPercentageDiscount = product.offer || 0;
        const categoryPercentageDiscount = product.category.offer || 0;
        const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);

        const percentageDiscountAmount = Math.round((totalMRP * (percentageDiscount / 100)) * 100) / 100;
        const priceAfterPercentageDiscount = Math.round((totalMRP - percentageDiscountAmount) * 100) / 100;

        // Fixed amount discounts
        const productFixedDiscount = product.fixedAmount || 0;
        const categoryFixedDiscount = product.category.fixedAmount || 0;
        const fixedDiscountAmount = Math.max(productFixedDiscount, categoryFixedDiscount);

        const totalDiscount = Math.round(Math.max(percentageDiscountAmount, fixedDiscountAmount) * 100) / 100;

        const priceAfterFixedDiscount = Math.round(Math.max(totalMRP - productFixedDiscount, totalMRP - categoryFixedDiscount) * 100) / 100;
        const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
        const totalDiscountPrice = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;
        const finalAmount = Math.round(totalDiscountPrice * 100) / 100;

        const products = [{
            productId: product,
            quantity: quantity,
        }];

        const addresses = await Addresses.find({ userId });
        const paymentMethods = Orders.schema.path('paymentMethod').enumValues;
        res.render('user/order/checkout', {
            products, addresses, paymentMethods, session, totalMRP, totalDiscount, finalAmount,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error(error)
        res.status(500).json("Error in buy now checkout")
    }
}

exports.checkout = async (req, res) => {
    const session = req.session.user;
    const userId = session._id;
    try {
        const cart = await Carts.findOne({ userId }).populate('products.productId');
        const addresses = await Addresses.find({ userId });
        const paymentMethods = Orders.schema.path('paymentMethod').enumValues;
        
        const products = cart ? cart.products : [];

        const totalMRP = products.reduce((sum, item) => {
            return sum + (item.productId.mrp * item.quantity);
        }, 0);

        const finalAmount = cart ? cart.totalAmount : 0;
        
        const totalDiscount = totalMRP - finalAmount;

        res.render('user/order/checkout', {
            addresses,
            paymentMethods,
            session,
            products,
            totalMRP,
            totalDiscount,
            finalAmount,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).json({ error: "Failed to load checkout page" });
    }
};

exports.orderCreation = async (req,res)=>{
    const userId = req.session.user._id;
    const coupon = req.session.user.appliedCoupon;
    const { total, paymentType, addressId, singleProductId, productsLength } = req.body;
    console.log("total from req.body:", total);
    console.log("productsLength:", productsLength);
    console.log("singleProductId:", singleProductId);
    try {
        // Validate address
        if (!addressId) {
            return res.status(400).json({ message: "Please select a delivery address" });
        }
        // Validate address belongs to user
        const address = await Addresses.findOne({ _id: addressId, userId });
        if (!address) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }

        let subtotal, productsWithLatestPrices;
        if(parseInt(productsLength) >1){
            const cart = await Carts.findOne({ userId })
                .populate({
                    path:'products.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });
            if (!cart) {
                return res.status(400).json({ message: "Cart is empty" });
            }

            // Calculate latest price for each product
            productsWithLatestPrices = cart.products.map(item => {
                const product = item.productId;
    
                // Calculate percentage discounts
                const productPercentageDiscount = product.offer || 0;
                const categoryPercentageDiscount = product.category ? product.category.offer || 0 : 0;
                const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);
    
                // Calculate price after percentage discounts
                const discountAmount = Math.round((product.mrp * (percentageDiscount / 100)) * 100) / 100;
                const priceAfterPercentageDiscount = Math.round((product.mrp - discountAmount) * 100) / 100;
    
                const productFixedDiscount = product.fixedAmount || 0;
                const categoryFixedDiscount = product.category ? product.category.fixedAmount || 0 : 0;
    
                const priceAfterFixedDiscount = Math.round(Math.max(product.mrp - productFixedDiscount, product.mrp - categoryFixedDiscount) * 100) / 100;
                const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
                const discountedPrice = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;
    
                return {
                    productId: product._id,
                    quantity: item.quantity,
                    priceAtPurchase: discountedPrice
                };
            });
    
            // Calculate total amount before coupon
            subtotal = productsWithLatestPrices.reduce((total, item) => {
                return total + (item.priceAtPurchase * item.quantity);
            }, 0);

            // Check if all products in the order are in the cart
            const allProductsInCart = productsWithLatestPrices.every(orderProduct =>
                cart.products.some(cartProduct => cartProduct.productId._id.equals(orderProduct.productId))
            );

            // Only delete the cart if all products are in the order
            if (allProductsInCart) {
                await Carts.deleteOne({ userId });
            }
        } else if(parseInt(productsLength) === 1){
            const product = await Products.findById( singleProductId ).populate('category');
            if (!product) {
                return res.status(400).json({ message: "Product not found" });
            }

            const totalMRP = product.mrp;

            // Percentage discounts
            const productPercentageDiscount = product.offer || 0;
            const categoryPercentageDiscount = product.category.offer || 0;
            const percentageDiscount = Math.max(productPercentageDiscount, categoryPercentageDiscount);

            const percentageDiscountAmount = Math.round((totalMRP * (percentageDiscount / 100)) * 100) / 100;
            const priceAfterPercentageDiscount = Math.round((totalMRP - percentageDiscountAmount) * 100) / 100;

            // Fixed amount discounts
            const productFixedDiscount = product.fixedAmount || 0;
            const categoryFixedDiscount = product.category.fixedAmount || 0;
            const fixedDiscountAmount = Math.max(productFixedDiscount, categoryFixedDiscount);

            const totalDiscount = Math.round(Math.max(percentageDiscountAmount, fixedDiscountAmount) * 100) / 100;

            const priceAfterFixedDiscount = Math.round(Math.max(totalMRP - productFixedDiscount, totalMRP - categoryFixedDiscount) * 100) / 100;
            const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
            const totalPriceAfterDiscount = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;
            subtotal = Math.round(totalPriceAfterDiscount * 100) / 100;
            
            productsWithLatestPrices = [
                {
                    productId: product._id,
                    quantity: 1,
                    priceAtPurchase: subtotal
                }
            ];
            
        }
        console.log("Subtotal before coupon:", subtotal);
        let couponDiscountAmount = 0;
        if (coupon) {
            if (coupon.discountType === 'PERCENTAGE') {
                couponDiscountAmount = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscount) {
                    couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maxDiscount);
                }
            } else if (coupon.discountType === 'FIXED') {
                couponDiscountAmount = Math.min(coupon.discountValue, subtotal);
            }
            req.session.user.appliedCoupon = null;
        }
        console.log("Coupon Discount Amount:", couponDiscountAmount);

        const effectiveTotal = Math.round((subtotal - couponDiscountAmount) * 100) / 100; // Round to 2 decimal placessubtotal - couponDiscountAmount;
        console.log("Effective Total:", effectiveTotal);

        if (isNaN(effectiveTotal)) {
            return res.status(400).json({ message: "Error calculating total amount" });
        }

        const newOrder = new Orders({
            userId, 
            address,
            products: productsWithLatestPrices,
            totalAmount: effectiveTotal,
            paymentMethod: paymentType,
            'coupon.couponCode':coupon ? coupon.code : null,
            'coupon.couponId':coupon ? coupon.id : null
        });

        await newOrder.save();

        // Update inventory
        if(parseInt(productsLength) === 1) {
            await Products.findByIdAndUpdate(singleProductId, {
                $inc: { inventory: -1 }
            });
        } else {
            const cart = await Carts.findOne({ userId })
                .populate({
                    path:'products.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });
            if(cart){
                for (const item of cart.products) {
                    const productId = item.productId._id;
                    const quantityOrdered = item.quantity;
        
                    await Products.findByIdAndUpdate(productId, {
                        $inc: { inventory: -quantityOrdered }
                    });
                }
            }
        }
        console.log("order created successfully")
        res.status(200).json({ success: true, message: "Order placed successfully", order: newOrder });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to place order" });
    }
}

exports.handlePaymentSuccess = async (req,res)=>{
    try{
        const { orderId } = req.body;
        await Orders.findByIdAndUpdate(orderId, { paymentStatus: "Success" });
        res.status(200).json({message:"Payment success"})
    }catch(err){
        console.error(err)
        res.status(500).json({message:"Error in changing payment status to success"})
    }
}

exports.showOrdersUser = async (req,res)=>{
    try {
        const session = req.session.user
        const userId = session._id

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const orders = await Orders.find({userId}).populate("products.productId").sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalOrders = await Orders.countDocuments({ userId });
        const totalPages = Math.ceil(totalOrders / limit);
        res.render('user/dashboard/orders',{
            orders,
            session,
            activeTab: 'orders',
            page,
            totalPages,
            limit,
            totalOrders
        })
    } catch (error) {
        console.error(error)
        res.status(500).render('error', { message: "Unable to retrieve orders." });
    }
}

exports.getOrdersAdmin = async (req,res)=>{
    try {
        const orderStatuses = Orders.schema.path('status').enumValues;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const orders = await Orders.find({})
            .populate('userId', 'username email')
            .populate({
                path: 'products.productId',
                model: 'product',
                select: 'name image sellingPrice'
            })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalOrders = await Orders.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/order folder/orders', {
            orders, activeTab: 'orders', orderStatuses,
            page,
            totalPages,
            limit,
            totalOrders
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Unable to retrieve orders." });
    }
}

exports.cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Fetch the order
        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if the order is eligible for cancellation
        if (["Cancelled", "Delivered", "Returned"].includes(order.status)) {
            return res.status(400).json({ message: "Order cannot be cancelled." });
        }

        // Update order status and product inventory
        await Orders.findByIdAndUpdate(orderId, {
            status: "Cancelled",
            cancelledOn: Date.now(),
        });

        // Restore product inventory
        for (const item of order.products) {
            await Products.findByIdAndUpdate(item.productId, {
                $inc: { inventory: item.quantity }
            });
        }

        res.status(200).json({ message: "Order cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ message: "Failed to cancel order" });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;

        // Fetch the order
        const order = await Orders.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check for valid status transition
        if (["Cancelled", "Delivered", "Returned"].includes(order.status)) {
            return res.status(400).json({ message: "Order status cannot be updated further." });
        }

        if (status === "Delivered") {
            await Orders.findByIdAndUpdate(orderId, { status, deliveredOn: Date.now() });
            if(order.paymentMethod === "COD"){
                await Users.findByIdAndUpdate(orderId, { paymentStatus: "Success" });
            }
        } else if (status === "Cancelled") {
            const updateInventoryPromises = order.products.map((item) =>
                Products.findByIdAndUpdate(
                    item.productId,
                    { $inc: { inventory: item.quantity } } // Increment inventory
                )
            );
            await Promise.all(updateInventoryPromises);
            await Orders.findByIdAndUpdate(orderId, { status, cancelledOn: Date.now() });
        } else if (status === "Returned") {
            await Orders.findByIdAndUpdate(orderId, { status, returnedOn: Date.now() });
        } else {
            await Orders.findByIdAndUpdate(orderId, { status });
        }

        res.status(200).json({ message: "Order status updated successfully." });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Failed to update order status." });
    }
};