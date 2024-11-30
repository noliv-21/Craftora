const Razorpay = require('razorpay');
const crypto = require('crypto');
const Orders = require('../models/orderSchema')

// Initialize Razorpay
const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
});

// Add payment verification
const verifyPayment = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
            .update(sign.toString())
            .digest("hex");

        console.log('Signature comparison:', {
            received: razorpay_signature,
            expected: expectedSign
        });

        if (razorpay_signature === expectedSign) {
            const updateOrder = await Orders.findByIdAndUpdate(orderId,
                {
                    $set: {paymentStatus: status, status:"Order Placed" }
                },
                { new: true }
            );
            console.log('Updated order:', updateOrder);
            res.status(200).json({ success: true, message: "Payment verified successfully" });
        } else if(razorpay_signature !== expectedSign){
            const order = await Orders.findById(orderId);
            if (!order) {
                console.log('Order not found:', orderId);
                return res.status(404).json({ error: "Order not found" });
            }
            const updateOrder = await Orders.findByIdAndUpdate(orderId,
                {
                    $set: {paymentStatus: status, status:"Payment failed" }
                },
                { new: true }
            );
            console.log('Updated order:', updateOrder);
            res.status(200).json({ success: true, message: "Order payment failed", order: updateOrder });
        }else{
            res.status(200).json({ success: false, message: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, error: "Payment verification failed" });
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Get amount from request
        if (!amount) {
            return res.status(400).json({ success: false, error: "Amount is required" });
        }
        const rzpOrder = await rzp.orders.create({
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: `receipt#${Date.now()}`, // Generate a unique receipt ID
            payment_capture: true,
            notes: {
                orderType: "Order pre-payment",
            },
        });

        res.status(200).json({ success: true, order: rzpOrder });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, error: "Failed to create Razorpay order" });
    }
};

const handleWebhook = async (req, res) => {
    try {
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest === req.headers['x-razorpay-signature']) {
            const event = req.body.event;
            switch (event) {
                case 'payment.captured':
                    // Handle successful payment
                    await Orders.findOneAndUpdate(
                        { razorpay_order_id: req.body.payload.order.entity.id },
                        { $set: { status: 'PAID', payment_id: req.body.payload.payment.entity.id } }
                    );
                    break;
                case 'payment.failed':
                    // Handle failed payment
                    await Orders.findOneAndUpdate(
                        { razorpay_order_id: req.body.payload.order.entity.id },
                        { $set: { status: 'PAYMENT_FAILED' } }
                    );
                    break;
                default:
                    console.log('Unhandled event:', event);
            }
            res.status(200).json({ status: 'ok' });
        } else {
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

module.exports = {
    createRazorpayOrder,
    verifyPayment,
    handleWebhook
}