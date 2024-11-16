const mongoose = require('mongoose')
const crypto = require('crypto')

const orderSchema = new mongoose.Schema({
    orderId:{
        type:String,
        unique:true
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:'user'
    },
    addressId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'product',
                required: true
            },
            quantity: {
                type: Number,
                default: 1
            },
            priceAtPurchase: {
                type: Number,
                required: true // Price of the product at the time of purchase
            }
        }
    ],
    status:{
        type: String,
        enum: ["Order Placed","Cancelled","Processing","Shipped","Out for delivery","Delivered","Returned"],
        required: true,
        default: "Order Placed"
    },
    paymentMethod:{
        type:String,
        enum:["COD","Credit Card","Internet Banking","UPI","Wallet"],
        required: true,
        default:"COD"
    },
    totalAmount:{
        type:Number,
        default:0
    },
    taxAmount:{
        type:Number,
        default:0
    },
    shippingAmount:{
        type:Number,
        default:0
    },
    coupons: [
        {
            couponId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'coupon'
            },
            appliedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    appliedOffers: [
        {
            offerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'offer'
            },
            appliedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    deliveredOn: { type: Date, default: null },
    cancelledOn: { type: Date, default: null },
    returnedOn: { type: Date, default: null },
}, { timestamps: true })

orderSchema.pre('save', async function (next) {
    if (!this.orderId) {
        // Generate unique orderId
        const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();
        const timestamp = Date.now().toString().slice(-6);
        this.orderId = `ORD-${randomString}-${timestamp}`;
    }
    next();
});

const orderModel = mongoose.model('order',orderSchema,'Orders')

module.exports = orderModel;