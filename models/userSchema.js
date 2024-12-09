const mongoose = require('mongoose')

//userSchema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        sparse: true
    },
    fullname: { type: String },
    email: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required:false
    },
    gender: { type: String },
    phone: { type: Number,
        required:false,
        sparse:true,
        default:null
    },
    isBlocked: {
        type: Boolean,
        default:false
    },
    isGoogleUser:{
        type:Boolean,
        default:false
    },
    claimedCoupons: [
        {
            couponId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'coupon'
            },
            claimedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    isVerified: { type: Boolean },
    googleId:{
        type:String,
        unique:false
    }
},{ timestamps: true })

//userReview
// const user_review=new mongoose.Schema({
//     user_id:{type:Ob}
// })

const userModel = mongoose.model("user", userSchema, "users")

module.exports = userModel