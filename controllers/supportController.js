const Supports = require('../models/supportSchema')

// Render support page
exports.supportPage = async (req, res) => {
    const session = req.session.user;
    const title = "Craftora Support";
    try {
        // Get user's existing support tickets
        const existingTickets = await Supports.find({ 
            userId: session._id, status:'open'
        }).sort({ createdAt: -1 });

        res.render('user/support', {
            session, 
            title,
            existingTickets
        });
    } catch (error) {
        console.error(error);
        res.status(500).json("Server error");
    }
};

// Handle new support message submission
exports.submitSupport = async (req, res) => {
    try {
        const { email,reason, comment } = req.body;
        const userId = req.session.user._id;

        if (!email || !reason || !comment) {
            req.flash('error', 'All fields are required');
            return res.redirect('/user/support');
        }

        // Create new support ticket
        const newSupportTicket = new Supports({
            userId,
            subject: reason,
            email,
            category: determineCategory(reason), // Helper function to categorize the issue
            messages: [{
                sender: 'user',
                content: comment
            }]
        });

        await newSupportTicket.save();

        // req.flash('success', 'Support ticket created successfully');
        // Send success response
        console.log('Support ticket created successfully');
        res.status(200).json({
            success: true,
            message: 'Support ticket created successfully',
            ticketId: newSupportTicket._id
        });

    } catch (error) {
        console.error(error);
        // req.flash('error', 'Failed to create support ticket');
        res.status(500).json({
            success: false,
            message: 'Error in support submission'
        });
    }
};

// Helper function to determine category based on reason
function determineCategory(reason) {
    const reason_lower = reason.toLowerCase();
    
    if (reason_lower.includes('order')) return 'order';
    if (reason_lower.includes('deliver')) return 'delivery';
    if (reason_lower.includes('account')) return 'account';
    if (reason_lower.includes('refund')) return 'refund';
    if (reason_lower.includes('payment')) return 'payment';
    if (reason_lower.includes('cancel')) return 'cancellation';
    
    return 'other';
}

// Add message to existing ticket
exports.addMessage = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const { message } = req.body;
        const userId = req.session.user._id;

        // Find the ticket and verify ownership
        const ticket = await Supports.findOne({
            _id: ticketId,
            userId
        });

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        // Add new message to the ticket
        ticket.messages.push({
            sender: 'user',
            content: message
        });

        await ticket.save();

        res.status(200).json({
            success: true,
            message: 'Message added successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error adding message'
        });
    }
};

exports.closeTicket = async (req,res)=>{
    const ticketId = req.params.ticketId;
    const userId = req.session.user._id;
    try {
        await Supports.findOneAndUpdate({_id:ticketId, userId}, { status:'closed' })
        res.status(200).json({ message: "Ticket closed" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message:"Server error" })
    }
}