const Wallets = require('../models/walletSchema');

const walletPage = async (req,res)=>{
    try {
        const session = req.session.user;
        const userId = session._id;
        let wallet = await Wallets.findOne({ userId: userId });
        if (!wallet) {
            wallet = new Wallets({ userId: userId, transactions: [] });
            await wallet.save();
        }
        res.render('user/dashboard/wallet', {
            userWallet: wallet, session, activeTab: 'wallet'
        } )
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch wallet' });
    }
}

const addMoneyToWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user._id;

        if(!amount  || amount <= 0){
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        // Update wallet balance in your database
        const wallet = await Wallets.findOneAndUpdate(
            { userId },
            { $inc: { balance: amount } },
            { new: true }
        );

        if (!wallet) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wallet not found' 
            });
        }

        console.log("Money added to wallet successfully");
        res.json({ success: true, balance: wallet.balance, message: 'Money added successfully' });
    } catch (error) {
        console.error("Error adding money to wallet:", error);
        res.status(500).json({ success: false, message: 'Failed to add money' });
    }
};

module.exports = {
    addMoneyToWallet, walletPage
}