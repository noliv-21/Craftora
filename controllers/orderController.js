const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')
const Wallets = require('../models/walletSchema')
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

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
    // const { total, paymentType, addressId, singleProductId, productsLength } = req.body;
    const { orderData } = req.body;
    console.log("orderData:", orderData);
    try {
        // Validate address
        if (!orderData.addressId) {
            return res.status(400).json({ message: "Please select a delivery address" });
        }
        // Validate address belongs to user
        const address = await Addresses.findOne({ _id: orderData.addressId, userId });
        if (!address) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }

        let subtotal, productsWithLatestPrices, totalDiscountAmount;
        if(!orderData.buyNow){
            const cart = await Carts.findOne({ userId })
                .populate({
                    path:'products.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });
            if (!cart || !cart.products || cart.products.length === 0) {
                return res.status(400).json({ success: false, message: "Cart is empty" });
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

            // Calculate total discount (difference between MRP total and discounted total)
            const mrpTotal = cart.products.reduce((total, item) => {
                return total + (item.productId.mrp * item.quantity);
            }, 0);
            totalDiscountAmount = Math.round((mrpTotal - subtotal) * 100) / 100;
            
            // Check if all products in the order are in the cart
            const allProductsInCart = productsWithLatestPrices.every(orderProduct =>
                cart.products.some(cartProduct => cartProduct.productId._id.equals(orderProduct.productId))
            );

            // Only delete the cart if all products are in the order
            if (allProductsInCart) {
                await Carts.deleteOne({ userId });
            }
        } else if(orderData.buyNow){
            if (!orderData.productId) {
                return res.status(400).json({ success: false, message: "Product ID is required for buy now order" });
            }

            const product = await Products.findById( orderData.productId ).populate('category');
            if (!product) {
                return res.status(400).json({ success:false, message: "Product not found" });
            }

            const totalMRP = product.mrp;
            // const totalMRP = product.mrp*orderData.quantity;

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

            totalDiscountAmount = Math.round(Math.max(percentageDiscountAmount, fixedDiscountAmount) * 100) / 100;

            const priceAfterFixedDiscount = Math.round(Math.max(totalMRP - productFixedDiscount, totalMRP - categoryFixedDiscount) * 100) / 100;
            const finalDiscountedPrice = Math.round(Math.min(priceAfterPercentageDiscount, priceAfterFixedDiscount) * 100) / 100;
            const totalPriceAfterDiscount = Math.round(Math.max(0, finalDiscountedPrice) * 100) / 100;
            subtotal = totalPriceAfterDiscount*orderData.quantity;
            console.log("Subtotal before coupon:", subtotal);

            productsWithLatestPrices = [
                {
                    productId: product._id,
                    quantity: orderData.quantity,
                    priceAtPurchase: totalPriceAfterDiscount
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

        totalDiscountAmount = Math.round((totalDiscountAmount - couponDiscountAmount) * 100) / 100;
        console.log("Total Discount Amount:", totalDiscountAmount);

        if (isNaN(effectiveTotal)) {
            return res.status(400).json({ message: "Error calculating total amount" });
        }
        let newOrder;
        if(orderData.paymentType === "Wallet"){
            try {
                const wallet = await Wallets.findOne({userId})
                if(!wallet){
                    return res.status(404).json({ message: "Wallet not found" });
                }
                if(wallet.balance < effectiveTotal){
                    return res.status(400).json({ message: "Insufficient balance in wallet" });
                }

                // Atomicity
                const session = await mongoose.startSession();
                try {
                    await session.withTransaction(async ()=>{
                        await Wallets.findOneAndUpdate(
                            {userId},
                            {$inc: { balance: -effectiveTotal }},
                            { session }
                        )

                        newOrder = new Orders({
                            userId, 
                            address,
                            products: productsWithLatestPrices,
                            totalAmount: effectiveTotal,
                            totalDiscountAmount,
                            paymentMethod: orderData.paymentType,
                            paymentStatus: "Success",
                            'coupon.couponCode': coupon ? coupon.code : null,
                            'coupon.couponId': coupon ? coupon.id : null
                        });
                        await newOrder.save({ session });

                        if (coupon) {
                            const user = await Users.findById(userId);
                        
                            // Find the coupon in the user's claimedCoupons
                            const claimedCoupon = user.claimedCoupons.find(c => c.couponId.equals(coupon.id));
                        
                            if (claimedCoupon) {
                                // Increment the usage count if the coupon is already claimed
                                claimedCoupon.usageCount += 1;
                            } else {
                                // Add the coupon to claimedCoupons if not already present
                                user.claimedCoupons.push({
                                    couponId: coupon.id,
                                    usageCount: 1,
                                    claimedAt: new Date()
                                });
                            }
                        
                            // Save the updated user document
                            await user.save({ session });
                        }

                        // Inventory updation
                        if(orderData.buyNow) {
                            await Products.findByIdAndUpdate(
                                orderData.productId, 
                                { $inc: { inventory: -orderData.quantity } },
                                { session }
                            );
                        } else {
                            const cart = await Carts.findOne({ userId })
                                .populate('products.productId');
                            if(cart){
                                for (const item of cart.products) {
                                    const productId = item.productId._id;
                                    const quantityOrdered = item.quantity;
                        
                                    await Products.findByIdAndUpdate(productId, {
                                        $inc: { inventory: -quantityOrdered }},
                                        { session }
                                    );
                                }
                                await Carts.findOneAndDelete({ userId }, { session });
                            }
                        }
                    });
                    return res.status(200).json({ 
                        success: true, 
                        message: "Order placed successfully",
                        order: newOrder
                    });
                }catch (error){
                    console.error("Error in transaction:", error);
                    return res.status(500).json({ 
                        success: false, 
                        message: "Failed to process transaction",
                        error: error.message 
                    }); 
                } finally {
                    await session.endSession();
                    console.log("order created successfully")
                }
            } catch (error) {
                console.error("Error in wallet payment:", error);
                return res.status(500).json({ 
                    success: false, 
                    message: "Failed to process wallet payment",
                    error: error.message 
                });
            }
        }
        
        // Non-wallet payment
        try {
            newOrder = new Orders({
                userId, 
                address,
                products: productsWithLatestPrices,
                totalAmount: effectiveTotal,
                totalDiscountAmount,
                paymentMethod: orderData.paymentType,
                'coupon.couponCode':coupon ? coupon.code : null,
                'coupon.couponId':coupon ? coupon.id : null
            });
            await newOrder.save();
            
            if (coupon) {
                const user = await Users.findById(userId);
            
                // Find the coupon in the user's claimedCoupons
                const claimedCoupon = user.claimedCoupons.find(c => c.couponId.equals(coupon.id));
            
                if (claimedCoupon) {
                    // Increment the usage count if the coupon is already claimed
                    claimedCoupon.usageCount += 1;
                } else {
                    // Add the coupon to claimedCoupons if not already present
                    user.claimedCoupons.push({
                        couponId: coupon.id,
                        usageCount: 1,
                        claimedAt: new Date()
                    });
                }
            
                // Save the updated user document
                await user.save();
            }
    
            // Update inventory
            if(orderData.buyNow) {
                await Products.findByIdAndUpdate(orderData.productId, {
                    $inc: { inventory: -orderData.quantity }
                });
            } else {
                const cart = await Carts.findOne({ userId })
                    .populate('products.productId');
                if(cart){
                    for (const item of cart.products) {
                        const productId = item.productId._id;
                        const quantityOrdered = item.quantity;
            
                        await Products.findByIdAndUpdate(productId, {
                            $inc: { inventory: -quantityOrdered }
                        });
                    }
                    await Carts.findOneAndDelete({ userId });
                }

            }
            return res.status(200).json({ 
                success: true, 
                message: "Order placed successfully",
                order: newOrder
            });
        } catch (error) {
            console.error("Error in non-wallet payment:", error);
            return res.status(500).json({ 
                success: false, 
                message: "Failed to process payment",
                error: error.message 
            });
        }
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to place order" });
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
        res.render('user/dashboard/order folder/orders',{
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

exports.orderDetailsUser = async (req,res)=>{
    try {
        const orderId = req.params.orderId
        const session = req.session.user
        const order = await Orders.findById(orderId).populate("products.productId")
        res.render('user/dashboard/order folder/order_details', {
            order, session, activeTab: 'orders', razorpayKey: process.env.RAZORPAY_KEY_ID
        })
        console.log("Order details page loaded")
    } catch (error) {
        console.error(error)
        res.status(500).render('error', { message: "Unable to retrieve order details." });
    }
}

exports.getOrdersAdmin = async (req,res)=>{
    try {
        const orderStatuses = Orders.schema.path('status').enumValues;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const returnRequests = await Orders.find({ 'returnDetails.returnStatus':'Requested'}).populate({
            path: 'products.productId',
            select: 'name'
        }).populate('userId')

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
            orders, activeTab: 'orders', orderStatuses, returnRequests,
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

        const isPrepaid = (order.paymentMethod === "Online" || order.paymentMethod === "Wallet") && order.paymentStatus === "Success";

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Update order status and product inventory
            await Orders.findByIdAndUpdate(orderId, {
                status: "Cancelled",
                cancelledOn: Date.now(),
            },{session});
    
            // Restore product inventory
            for (const item of order.products) {
                await Products.findByIdAndUpdate(item.productId, {
                    $inc: { inventory: item.quantity }
                },{session});
            }
    
            if (isPrepaid) {
                const wallet = await Wallets.findOneAndUpdate(
                    { userId: order.userId },
                    { 
                        $inc: { balance: order.totalAmount },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: order.totalAmount,
                                description: `Refund for cancelled order #${order.orderId}`
                            }
                        }
                    },
                    { 
                        session,
                        new: true,
                        upsert: true
                    }
                );
            }
            await session.commitTransaction();
            res.status(200).json({ message: "Order cancelled successfully" });
        } catch (error) {
            await session.abortTransaction();
            console.error("Error cancelling order:", error);
            return res.status(500).json({ message: "Failed to cancel order" });
        } finally {
            session.endSession();
        }
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
        if (status === "Returned") {
            if (order.status !== "Delivered") {
                return res.status(400).json({ message: "Only delivered orders can be returned." });
            }
        } else if (["Cancelled"].includes(order.status)) {
            return res.status(400).json({ message: "Cancelled orders cannot be updated further." });
        } else if (["Returned"].includes(order.status)) {
            return res.status(400).json({ message: "Returned orders cannot be updated further." });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            if (status === "Delivered") {
                await Orders.findByIdAndUpdate(
                    orderId,
                    { status, deliveredOn: Date.now() },
                    { session }
                );
                if(order.paymentMethod === "COD"){
                    await Users.findByIdAndUpdate(
                        orderId,
                        { paymentStatus: "Success" },
                        { session}
                    );
                }
            } else if (status === "Cancelled") {
                const isPrepaid = (order.paymentMethod === "Online" || order.paymentMethod === "Wallet") && order.paymentStatus === "Success";

                const updateInventoryPromises = order.products.map((item) =>
                    Products.findByIdAndUpdate(
                        item.productId,
                        { $inc: { inventory: item.quantity } }, // Increment inventory
                        { session }
                    )
                );
                await Promise.all(updateInventoryPromises);

                await Orders.findByIdAndUpdate(
                    orderId,
                    { status, cancelledOn: Date.now() },
                    { session }
                );

                if (isPrepaid) {
                    await Wallets.findOneAndUpdate(
                        { userId: order.userId },
                        { 
                            $inc: { balance: order.totalAmount },
                            $push: {
                                transactions: {
                                    type: 'credit',
                                    amount: order.totalAmount,
                                    description: `Refund for cancelled order #${order.orderId}`
                                }
                            }
                        },
                        { 
                            session,
                            new: true,
                            upsert: true
                        }
                    );
                }
            } else if (status === "Returned") {
                await Orders.findByIdAndUpdate(
                    orderId, 
                    { status, returnedOn: Date.now() },
                    { session }
                );

                await Wallets.findOneAndUpdate(
                    { userId: order.userId },
                    { 
                        $inc: { balance: order.totalAmount },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: order.totalAmount,
                                description: `Refund for returned order #${order.orderId}`
                            }
                        }
                    },
                    { 
                        session,
                        new: true,
                        upsert: true
                    }
                );
            } else {
                await Orders.findByIdAndUpdate(
                    orderId, 
                    { status },
                    { session }
                );
            }
            await session.commitTransaction();
            res.status(200).json({ message: "Order status updated successfully." });
        } catch(err) {
            console.error(err)
            await session.abortTransaction();
            return res.status(500).json({ message: "Failed to update order status." });
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: "Failed to update order status." });
    }
};

exports.returnOrder = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        const returnReason = req.body.returnReason;
        await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnRequested': true, 'returnDetails.returnReason': returnReason })
        res.status(200).json({ message: "Return request sent" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
    }
}

exports.approveReturnRequest = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Approved', status:'Returned' })
        await Wallets.findOneAndUpdate({ userId: order.userId},{ 
            $inc: { balance: order.totalAmount },
            $push: {
                transactions: {
                    type: 'credit',
                    amount: order.totalAmount,
                    description: `Refund for returned order #${order.orderId}`
                }
            }
        })
        res.status(200).json({ message: "Return request approved" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
    }
}

exports.rejectReturnRequest = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        await Orders.findByIdAndUpdate(orderId, { 'returnDetails.returnStatus': 'Rejected' })
        res.status(200).json({ message: "Return request rejected" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
    }
}

exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Orders.findById(orderId)
            .populate("products.productId")
            .populate("userId", "username fullname email");
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (order.status !== 'Delivered') {
            return res.status(403).send('Invoice is only available for delivered orders');
        }
        // Create a new PDF document
        const doc = new PDFDocument({ 
            margin: 50,
            font: 'Helvetica' // Use Helvetica font which has better Unicode support
        });

        // Helper function to format currency
        const formatCurrency = (amount) => {
            return `Rs. ${Number(amount).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            })}`;
        };

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add the invoice header
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('Craftora', { align: 'center' });
        doc.fontSize(10).text('www.craftora.com', { align: 'center' });
        doc.moveDown();

        // Add a horizontal line
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        doc.moveDown();

        // Add order details
        doc.fontSize(12).text(`Order ID: #${orderId}`);
        doc.fontSize(10).text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.moveDown();

        // Add customer details
        doc.fontSize(12).text('Customer Details:');
        doc.fontSize(10).text(`Name: ${order.userId.fullname || order.userId.username}`);
        doc.fontSize(10).text(`Email: ${order.userId.email}`);
        doc.moveDown();

        // Add product table headers
        let yPos = doc.y;
        doc.fontSize(10)
           .text('Product', 50, yPos)
           .text('Quantity', 250, yPos)
           .text('Price', 350, yPos)
           .text('Total', 450, yPos);

        // Add a line below headers
        doc.moveTo(50, doc.y + 5)
           .lineTo(550, doc.y + 5)
           .stroke();
        doc.moveDown();

        // Add products
        let totalMRP = 0;
        order.products.forEach(item => {
            const price = Number(item.priceAtPurchase);
            const quantity = Number(item.quantity);
            const total = price * quantity;
            
            yPos = doc.y;
            doc.fontSize(10)
               .text(item.productId.name, 50, yPos, { width: 180 })
               .text(quantity.toString(), 250, yPos)
               .text(formatCurrency(price), 350, yPos)
               .text(formatCurrency(total), 450, yPos);
            
            totalMRP += Number(item.productId.mrp) * quantity;
            doc.moveDown();
        });

        // Add a line above totals
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();
        doc.moveDown();

        // Function to add aligned text
        const addAlignedText = (label, value, y) => {
            doc.text(label, 350, y);
            doc.text(value, 450, y, { align: 'left' });
        };

        // Add totals with proper alignment
        let currentY = doc.y;
        doc.fontSize(10);
        
        // Subtotal
        addAlignedText('Subtotal:', formatCurrency(totalMRP), currentY);
        currentY += 20;

        // Discount
        if (order.totalDiscountAmount) {
            addAlignedText('Discount:', `-${formatCurrency(Number(order.totalDiscountAmount))}`, currentY);
            currentY += 20;
        }

        // Coupon
        if (order.coupon && order.coupon.discountAmount) {
            addAlignedText(
                `Coupon (${order.coupon.couponCode}):`,
                `-${formatCurrency(Number(order.coupon.discountAmount))}`,
                currentY
            );
            currentY += 20;
        }

        // Final total with a line above
        doc.moveTo(350, currentY)
           .lineTo(550, currentY)
           .stroke();
        currentY += 10;

        doc.fontSize(12);
        addAlignedText('Total Amount:', formatCurrency(Number(order.totalAmount)), currentY);

        // Add footer
        doc.fontSize(10)
           .text('Thank you for shopping with us!', 50, 700, { align: 'center' });

        // Finalize the PDF
        doc.end();
    } catch (error) {
        console.error("Error downloading invoice:", error);
        res.status(500).json({ message: "Failed to download invoice" });
    }
}