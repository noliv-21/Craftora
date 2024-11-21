const Coupons = require('../models/couponSchema');
const Users = require('../models/userSchema');
const Orders = require('../models/orderSchema');

// Get user's available coupons and history
const getUserCoupons = async (req, res) => {
    try {
        const session = req.session.user;
        
        // Get available coupons - using $expr to compare fields
        const availableCoupons = await Coupons.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            $expr: { $lt: ["$usedCount", "$totalLimit"] }  // Compare usedCount with totalLimit
        }).sort({ createdAt: -1 });

        // Get user's coupon history
        const couponHistory = await Orders.find({
            userId: session._id,
            'couponApplied.coupon': { $exists: true }
        })
        .populate('couponApplied.coupon')
        .sort({ createdAt: -1 })
        .select('couponApplied orderId createdAt');

        // Format coupon history
        const formattedHistory = couponHistory.map(order => ({
            orderId: order.orderId,
            coupon: order.couponApplied.coupon,
            usedAt: order.createdAt,
            savedAmount: order.couponApplied.discountAmount
        }));

        res.render('user/dashboard/coupons', {
            session,
            activeTab: 'coupons',
            availableCoupons,
            couponHistory: formattedHistory,
            errorMessage: null,
            successMessage: null
        });
    } catch (error) {
        console.error('Error in getUserCoupons:', error);
        res.render('user/dashboard/coupons', {
            session: req.session.user,
            activeTab: 'coupons',
            errorMessage: 'Failed to load coupons',
            availableCoupons: [],
            couponHistory: [],
            successMessage: null
        });
    }
};

// Apply coupon
const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;

        // Find the coupon
        const coupon = await Coupons.findOne({
            couponCode: couponCode.toUpperCase(),
            isActive: true,
            expiryDate: { $gt: new Date() },
            $expr: { $lt: ["$usedCount", "$totalLimit"] }  // Compare usedCount with totalLimit
        });

        if (!coupon) {
            return res.status(400).json({ error: 'Invalid or expired coupon' });
        }

        // Check if user has already used this coupon
        const userUsageCount = await Orders.countDocuments({
            userId,
            'couponApplied.coupon': coupon._id
        });

        if (userUsageCount >= coupon.perUserLimit) {
            return res.status(400).json({ error: 'You have already used this coupon' });
        }

        // Save coupon to session for cart
        req.session.coupon = {
            id: coupon._id,
            code: coupon.couponCode,
            type: coupon.discountType,
            value: coupon.discountValue,
            minAmount: coupon.minAmount,
            maxAmount: coupon.maxAmount
        };

        res.json({
            message: 'Coupon applied successfully!',
            coupon: {
                code: coupon.couponCode,
                type: coupon.discountType,
                value: coupon.discountValue
            }
        });
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        res.status(500).json({ error: 'Failed to apply coupon' });
    }
};

// Get user's coupon history
const couponHistory = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const history = await Orders.find({
            userId,
            'couponApplied.coupon': { $exists: true }
        })
        .populate('couponApplied.coupon')
        .sort({ createdAt: -1 })
        .select('couponApplied orderId createdAt');

        const formattedHistory = history.map(order => ({
            orderId: order.orderId,
            coupon: order.couponApplied.coupon,
            usedAt: order.createdAt,
            savedAmount: order.couponApplied.discountAmount
        }));

        res.json(formattedHistory);
    } catch (error) {
        console.error('Error in couponHistory:', error);
        res.status(500).json({ error: 'Failed to fetch coupon history' });
    }
};

// Save promotional/referral coupon for user
const saveCouponUser = async (req, res) => {
    try {
        const { couponId } = req.body;
        const userId = req.session.user._id;

        const coupon = await Coupons.findById(couponId);
        if (!coupon || !coupon.isActive) {
            return res.status(400).json({ error: 'Invalid coupon' });
        }

        // Add coupon to user's saved coupons
        await Users.findByIdAndUpdate(userId, {
            $addToSet: { savedCoupons: couponId }
        });

        res.json({ message: 'Coupon saved successfully' });
    } catch (error) {
        console.error('Error in saveCouponUser:', error);
        res.status(500).json({ error: 'Failed to save coupon' });
    }
};

// Get applicable coupons for a product
const getProductCoupons = async (productId, userId) => {
    try {
        const today = new Date();
        
        // Check if user has any previous orders
        const hasOrders = await Orders.exists({ userId });
        
        // Get all active coupons that are not expired and not fully used
        const coupons = await Coupons.find({
            isActive: true,
            expiryDate: { $gt: today },
            $expr: { $lt: ["$usedCount", "$totalLimit"] }
        });

        // Filter coupons based on conditions
        const applicableCoupons = coupons.filter(coupon => {
            // First order coupons
            if (coupon.couponType === 'FIRST_ORDER') {
                return !hasOrders;
            }
            
            // Product-specific coupons
            if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
                return coupon.applicableProducts.includes(productId);
            }
            
            // General coupons (applicable to all products)
            return coupon.couponType === 'GENERAL';
        });

        return applicableCoupons;
    } catch (error) {
        console.error('Error in getProductCoupons:', error);
        return [];
    }
};

// Get coupons for product details page
const getProductDetailsCoupons = async (req, res) => {
    try {
        const productId = req.params.productId;
        const session = req.session.user;
        
        if (!session) {
            return res.json({ coupons: [] });
        }

        const applicableCoupons = await getProductCoupons(productId, session._id);
        
        res.json({
            coupons: applicableCoupons.map(coupon => ({
                code: coupon.couponCode,
                discount: coupon.discountType === 'PERCENTAGE' 
                    ? `${coupon.discountAmount}% OFF` 
                    : `₹${coupon.discountAmount} OFF`,
                minAmount: coupon.minAmount,
                description: coupon.description || 'Limited time offer!',
                type: coupon.couponType
            }))
        });
    } catch (error) {
        console.error('Error in getProductDetailsCoupons:', error);
        res.status(500).json({ error: 'Failed to fetch coupons' });
    }
};

const couponsPage_admin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const coupons = await Coupons.find().skip(skip).limit(limit);
        const totalOrders = await Coupons.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/coupon folder/coupons', {
            session: req.session.user,
            activeTab: 'coupons',
            coupons, limit, page, totalPages, totalOrders
        });
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Failed to render coupons page' });
    }
};

// Add this function to check coupon code availability
const checkCouponCode = async (req, res) => {
    try {
        const code = req.params.code;
        // Use Coupons model instead of Coupon
        const existingCoupon = await Coupons.findOne({ couponCode: code });
        res.json({ exists: !!existingCoupon });
    } catch (error) {
        console.error('Error checking coupon code:', error);
        res.status(500).json({ error: 'Failed to check coupon code' });
    }
};

// Add new coupon
const addCoupon = async (req, res) => {
    try {
        const {
            name,
            couponCode,
            description,
            discountType,
            discountValue,
            minAmount,
            maxDiscount,
            totalLimit,
            perUserLimit,
            expiryDate
        } = req.body;

        // Validate required fields
        if (!name || !couponCode || !description || !discountType || !expiryDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate numeric fields
        const numericFields = {
            discountValue: parseFloat(discountValue),
            minAmount: parseFloat(minAmount),
            maxDiscount: parseFloat(maxDiscount),
            totalLimit: parseInt(totalLimit),
            perUserLimit: parseInt(perUserLimit)
        };

        // Check if any numeric field is NaN
        for (const [field, value] of Object.entries(numericFields)) {
            if (isNaN(value)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid ${field} value`
                });
            }
        }

        // Validate expiry date
        const parsedExpiryDate = new Date(expiryDate);
        if (isNaN(parsedExpiryDate.getTime()) || parsedExpiryDate <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid expiry date. Must be a future date'
            });
        }

        const newCoupon = new Coupons({
            name: name.trim(),
            couponCode: couponCode.trim().toUpperCase(),
            description: description.trim(),
            discountType,
            discountValue: numericFields.discountValue,
            minAmount: numericFields.minAmount,
            maxDiscount: numericFields.maxDiscount,
            totalLimit: numericFields.totalLimit,
            perUserLimit: numericFields.perUserLimit,
            expiryDate: parsedExpiryDate
        });

        await newCoupon.save();
        res.status(200).json({ success: true, message: 'Coupon added successfully' });
    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to save coupon'
        });
    }
};

// Update existing coupon
const updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const updateData = {};

        // Extract and validate each field from req.body
        if (req.body.name) updateData.name = req.body.name;
        if (req.body.couponCode) updateData.couponCode = req.body.couponCode ? req.body.couponCode.toUpperCase() : '';
        if (req.body.description) updateData.description = req.body.description;
        if (req.body.discountType) updateData.discountType = req.body.discountType;
        if (req.body.discountValue) updateData.discountValue = Number(req.body.discountValue);
        if (req.body.minAmount) updateData.minAmount = Number(req.body.minAmount);
        if (req.body.maxDiscount) updateData.maxDiscount = Number(req.body.maxDiscount);
        if (req.body.totalLimit) updateData.totalLimit = Number(req.body.totalLimit);
        if (req.body.perUserLimit) updateData.perUserLimit = Number(req.body.perUserLimit);
        if (req.body.expiryDate) updateData.expiryDate = new Date(req.body.expiryDate);

        const updatedCoupon = await Coupons.findByIdAndUpdate(
            couponId, 
            updateData,
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, error: 'Coupon not found' });
        }

        res.json({ 
            success: true, 
            message: 'Coupon updated successfully',
            coupon: updatedCoupon 
        });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ success: false, error: 'Failed to update coupon' });
    }
};

// Toggle coupon active status
const toggleCouponStatus = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await Coupons.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({ success: false, error: 'Coupon not found' });
        }

        // Toggle the isActive status
        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.json({ 
            success: true, 
            message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
            isActive: coupon.isActive 
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle coupon status' });
    }
};

module.exports = {
    getUserCoupons,
    applyCoupon,
    couponHistory,
    saveCouponUser,
    getProductCoupons,
    getProductDetailsCoupons,
    couponsPage_admin,
    checkCouponCode,
    addCoupon,
    updateCoupon,
    toggleCouponStatus
};