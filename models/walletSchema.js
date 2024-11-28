const mongoose = require('mongoose')

const walletSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        ref: "user"
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

walletSchema.pre('findOneAndUpdate', async function(next){
    const update = this.getUpdate();

    if (update.$push && update.$push.transactions) {
        return next();
    }

    if (update.$inc && update.$inc.balance) {
        const amount = update.$inc.balance;
        const type = amount > 0 ? 'credit' : 'debit';

        this.updateOne({
            $push: {
                transactions: {
                    type,
                    amount: Math.abs(amount),
                    description: type === 'credit' ? 'Money added to wallet' : 'Money deducted from wallet'
                }
            }
        })
    }
    next();
})

const walletModel = mongoose.model("Wallet", walletSchema, "Wallets");
module.exports = walletModel;