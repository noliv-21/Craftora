const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
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
    // createdAt:{
    //     type:String,
    //     required:true
    // },
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
    ]
}, { timestamps: true })

const orderModel = mongoose.model('order',orderSchema,'Orders')

module.exports = orderModel;