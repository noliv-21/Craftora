const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ['user', 'admin'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const supportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open'
    },
    category: {
        type: String,
        required: true,
        enum: [
            'order',
            'delivery',
            'account',
            'refund',
            'payment',
            'cancellation',
            'other'
        ]
    },
    messages: [messageSchema]
}, { timestamps: true });

// Create indexes for better query performance
supportSchema.index({ userId: 1, createdAt: -1 });
supportSchema.index({ status: 1 });

const supportModel = mongoose.model('Support', supportSchema,"Supports");

module.exports = supportModel;