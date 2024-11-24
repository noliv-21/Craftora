const mongoose = require("mongoose")
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    offer: {
        type: Number,
        default: 0
    },
    fixedAmount: {
        type: Number,
        default: 0
    },
    createdAt: { type: String }
})

const Category = mongoose.model("Category", categorySchema)
module.exports = Category