const Carts = require('../models/cartSchema')
const Orders = require('../models/orderSchema')
const Addresses = require('../models/addressSchema')
const Users = require('../models/userSchema')
const Products = require('../models/productSchema')

exports.cfmPage = async (req, res) => {
    const userId = req.session.user._id
    const addressId = req.query.address
    req.session.user.orderAddress = addressId;
    try {
        const cart = await Carts.findOne({userId}).populate('products.productId');
        let total = 0;
        const products = cart ? cart.products : [];
        products.forEach(item => {
            const price = item.productId.sellingPrice || 0;
            total += price * item.quantity;
        });
        req.session.user.orderTotal = total;
        // const total = cart ? cart.totalAmount : 0;
        const productCount = products.length;
        const deliveryAddress = await Addresses.findById(addressId)
        res.render('user/order/confirmationPage', {
            deliveryAddress,products,total,productCount
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to initiate order confirmation" });
    }
};

exports.paymentPage = async (req,res)=>{
    const total = req.query.total;
    console.log("total Amount",total)
    try {
        const paymentMethods = Orders.schema.path('paymentMethod').enumValues;
        res.render('user/order/payment',{
            total, paymentMethods
        })
    } catch (error) {
        console.error(error)
    }
}

exports.orderCreation = async (req,res)=>{
    const userId = req.session.user._id;
    const { total, paymentType } = req.body;
    const addressId = req.session.user.orderAddress;
    req.session.user.orderAddress = null;
    try {
        const cart = await Carts.findOne({ userId }).populate('products.productId');
        if (!cart) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const newOrder = new Orders({
            userId, addressId,
            products: cart.products.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                priceAtPurchase: item.productId.sellingPrice
            })),
            totalAmount: total,
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
        // await Carts.findOneAndUpdate({ userId }, { $set: { products: [] }, totalAmount: 0 });
        
        res.status(200).json({ message: "Order placed successfully" });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Failed to place order" });
    }
}

exports.showOrdersUser = async (req,res)=>{
    try {
        const session = req.session.user
        const userId = session._id
        const orders = await Orders.find({userId}).populate("products.productId").sort({ createdAt: -1 })
        console.log(orders.products);
        res.render('user/dashboard/orders',{
            orders,session,activeTab:'orders'
        })
    } catch (error) {
        console.error(error)
        res.status(500).render('error', { message: "Unable to retrieve orders." });
    }
}

exports.getOrdersAdmin = async (req,res)=>{
    try {
        const orderStatuses = Orders.schema.path('status').enumValues;

        const orders = await Orders.find({})
            .populate('userId', 'username email')
            .populate({
                path: 'products.productId',
                model: 'product',
                select: 'name image sellingPrice'
            })
            .sort({ createdAt: -1 })

        res.render('admin/order folder/orders', {
            orders, activeTab: 'orders', orderStatuses
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

        const updateInventoryPromises = order.products.map((item) =>
            Products.findByIdAndUpdate(
                item.productId,
                { $inc: { inventory: item.quantity } } // Increment inventory
            )
        );
        await Promise.all(updateInventoryPromises);

        res.status(200).json({ message: "Order cancelled successfully." });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ message: "Server error. Unable to cancel the order." });
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