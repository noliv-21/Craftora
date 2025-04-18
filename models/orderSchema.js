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
    address:{
        name: {
            type: String,
            // required: true
        },
        phone: {
            type: Number,
            // required: true
        },
        typeOfAddress: {
            type: String,
            enum: ['Work', 'Home'],
            default: 'Home'
        },
        HouseNo: {
            type: String
        },
        streetAddress: {
            type: String,
            // required: true
        },
        city: {
            type: String,
            // required: true
        },
        state: {
            type: String,
            // required: true
        },
        country: {
            type: String,
            // required: true
        },
        pincode: {
            type: Number,
            // required: true
        }
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
        enum: ["Payment failed","Order Placed","Cancelled","Processing","Shipped","Out for delivery","Delivered","Returned"],
        required: true,
        default: "Order Placed"
    },
    returnDetails: {
        returnRequested: {
            type: Boolean,
            default: false
        },
        returnStatus: {
            type: String,
            enum: ["Requested", "Approved", "Rejected"]
        },
        returnReason: {
            type: String
        }
    },
    paymentMethod:{
        type:String,
        enum:["COD","Online","Wallet"],
        required: true,
        default:"COD"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Success", "Failed","Cancelled"],
        required: true,
        default: "Pending"
    },
    totalAmount:{
        type:Number,
        default:0
    },
    totalDiscountAmount:{
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
    coupon:{
        couponId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'coupon'
        },
        couponCode:{
            type: String
        }
    },
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

function updateReturnStatus(next) {
    const update = this.getUpdate();
    if (update['returnDetails.returnRequested'] && update['returnDetails.returnStatus'] !== "Requested") {
        update['returnDetails.returnStatus'] = "Requested";
    }
    if (update['returnDetails.returnStatus'] === "Approved") {
        update.status = "Returned";
    }
    next();
}

orderSchema.pre('findByIdAndUpdate', updateReturnStatus);
orderSchema.pre('findOneAndUpdate', updateReturnStatus);

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