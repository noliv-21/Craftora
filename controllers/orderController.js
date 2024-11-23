const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')

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
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).json({ error: "Failed to load checkout page" });
    }
};

exports.orderCreation = async (req,res)=>{
    const userId = req.session.user._id;
    const coupon = req.session.user.appliedCoupon;
    const { total, paymentType, addressId } = req.body;
    
    try {
        // Validate address
        if (!addressId) {
            return res.status(400).json({ message: "Please select a delivery address" });
        }

        const cart = await Carts.findOne({ userId }).populate('products.productId');
        if (!cart) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Validate address belongs to user
        const address = await Addresses.findOne({ _id: addressId, userId });
        if (!address) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }

        let couponDiscount;
        if(coupon){
           couponDiscount = coupon.discountValue;
        }
        const effectiveTotal = total - couponDiscount;
        const newOrder = new Orders({
            userId, 
            addressId,
            products: cart.products.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                priceAtPurchase: item.productId.sellingPrice
            })),
            totalAmount: effectiveTotal,
            paymentMethod: paymentType
        });

        await newOrder.save();

        for (const item of cart.products) {
            const productId = item.productId._id;
            const quantityOrdered = item.quantity;

            await Products.findByIdAndUpdate(productId, {
                $inc: { inventory: -quantityOrdered }
            });
        }

        await Carts.deleteOne({ userId });
        
        res.status(200).json({ success: true, message: "Order placed successfully" });
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