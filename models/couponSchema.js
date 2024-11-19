const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Coupon name is required'],
        trim: true
    },
    couponCode: {
        type: String,
        required: [true, 'Coupon code is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },
    discountType: {
        type: String,
        required: true,
        enum: ['PERCENTAGE', 'FIXED', 'REFERRAL'],
        default: 'PERCENTAGE'
    },
    discountValue: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0, 'Discount cannot be negative'],
        validate: {
            validator: function(value) {
                return this.discountType !== 'PERCENTAGE' || value <= 100;
            },
            message: 'Percentage discount cannot exceed 100%'
        }
    },
    minAmount: {
        type: Number,
        required: [true, 'Minimum amount is required'],
        min: [0, 'Minimum amount cannot be negative'],
        default: 0
    },
    maxAmount: {
        type: Number,
        required: [true, 'Maximum discount amount is required'],
        min: [0, 'Maximum amount cannot be negative'],
        default: 0
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required'],
        validate: {
            validator: function(value) {
                return value > new Date();
            },
            message: 'Expiry date must be in the future'
        }
    },
    image: {
        type: String,
        default: 'default-coupon.png'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    totalLimit: {
        type: Number,
        required: [true, 'Total usage limit is required'],
        min: [1, 'Limit must be at least 1'],
        default: 10
    },
    perUserLimit: {
        type: Number,
        required: [true, 'Per user limit is required'],
        min: [1, 'Per user limit must be at least 1'],
        default: 1
    },
    usedCount: {
        type: Number,
        default: 0
    },
    referralUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: function() {
            return this.discountType === 'REFERRAL';
        }
    },
},{timestamps:true});

// Add index for faster queries
couponSchema.index({ couponCode: 1, isActive: 1 });

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function() {
    return this.expiryDate < new Date();
});

// Virtual for checking if coupon is still available (not reached limit)
couponSchema.virtual('isAvailable').get(function() {
    return this.usedCount < this.limit && this.isActive && !this.isExpired;
});

const couponModel = mongoose.model("coupon", couponSchema, "Coupons");
module.exports = couponModel;