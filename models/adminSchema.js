const mongoose = require('mongoose')
//adminSchema
const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        sparse: true
    },
    password: { type: String },
    email: {
        type: String,
        unique: true,
        sparse: true
    },
    phone: { type: Number }
})

const adminModel = mongoose.model("admin", adminSchema, "admins")

module.exports = adminModel