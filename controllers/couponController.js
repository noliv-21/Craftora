const Coupons = require('../models/couponSchema');
const Users = require('../models/userSchema');
const Orders = require('../models/orderSchema');
const Carts = require('../models/cartSchema');
const mongoose = require('mongoose');

// Get user's available coupons and history
const getUserCoupons = async (req, res) => {
    try {
        const session = req.session.user;
        const userId = session._id;

        // Get all active coupons
        const coupons = await Coupons.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            startingDate: { $lt: new Date() },
            $expr: { $lt: ["$usedCount", "$totalLimit"] }
        }).sort({ createdAt: -1 });

        // Retrieve user's claimed coupons
        const user = await Users.findById(userId, {
            claimedCoupons: 1
        }).populate('claimedCoupons.couponId');

        const claimedCoupons = user.claimedCoupons.reduce((acc, claimed) => {
            acc[claimed.couponId._id.toString()] = claimed.usageCount;
            return acc;
        }, {});

        // Filter out coupons user has already used beyond their perUserLimit
        const availableCoupons = coupons.filter(coupon => {
            const usageCount = claimedCoupons[coupon._id.toString()] || 0;
            return usageCount < coupon.perUserLimit;
        });

        // Format coupon history
        const formattedHistory = user.claimedCoupons.map(claimed => ({
            coupon: claimed.couponId,
            usageCount: claimed.usageCount,
            claimedAt: claimed.claimedAt
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

const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const cart = await Carts.findOne({ userId });
        const cartTotal = cart ? cart.totalAmount : 0;

        // Get all active coupons
        const coupons = await Coupons.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            startingDate: { $lt: new Date()},
            minAmount: { $lte: cartTotal },
            // usedCount: { $lt: mongoose.Types.ObjectId('$totalLimit') }
        });

        // Retrieve user's claimed coupons
        const user = await Users.findById(userId);
        const claimedCoupons = user.claimedCoupons.reduce((acc, claimed) => {
            acc[claimed.couponId.toString()] = claimed.usageCount;
            return acc;
        }, {});

        // Filter out coupons user has already used beyond their perUserLimit
        const availableCoupons = coupons.filter(coupon => {
            const usageCount = claimedCoupons[coupon._id.toString()] || 0;
            return usageCount < coupon.perUserLimit && coupon.usedCount < coupon.totalLimit;
        }).map(coupon => ({
            code: coupon.couponCode,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minAmount: coupon.minAmount,
            maxDiscount: coupon.maxDiscount,
            expiryDate: coupon.expiryDate
        }));

        res.json(availableCoupons);
    } catch (error) {
        console.error('Error fetching available coupons:', error);
        res.status(500).json({ error: 'Failed to fetch available coupons' });
    }
};

// Apply coupon
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { couponCode } = req.body;

        // Find the coupon
        const coupon = await Coupons.findOne({
            couponCode: couponCode.toUpperCase(),
            isActive: true,
            expiryDate: { $gt: new Date() },
            // $expr: { $lt: ["$usedCount", "$totalLimit"] }  // Compare usedCount with totalLimit
        });

        if (!coupon) {
            return res.status(400).json({ error: 'Invalid or expired coupon' });
        }
        
        if (coupon.usedCount >= coupon.totalLimit) {
            return res.status(400).json({ error: 'This coupon has reached its maximum usage limit' });
        }

        // Check if user has already used this coupon
        const userUsageCount = await Orders.countDocuments({
            userId,
            'coupons.couponId': coupon._id
        });

        if (userUsageCount >= coupon.perUserLimit) {
            return res.status(400).json({ error: 'You have already used this coupon' });
        }
        // await Coupons.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
        // await Users.findByIdAndUpdate(userId, { $addToSet: { 'claimedCoupons.couponId': coupon._id } });
        // await Orders.findOneAndUpdate({ userId },{ $addToSet:{ "coupons.couponId": coupon._id }});
        req.session.user.appliedCoupon = {
            id: coupon._id,
            code: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount
        };
        // console.log(req.session.user.appliedCoupon);

        res.json({
            message: 'Coupon applied successfully!',
            coupon: {
                code: coupon.couponCode,
                type: coupon.discountType,
                value: coupon.discountValue,
                maxDiscount: coupon.maxDiscount
            }
        });
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        res.status(500).json({ error: 'Failed to apply coupon' });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const coupon = req.session.user.appliedCoupon;
        if (!coupon) {
            return res.status(400).json({ error: 'No coupon applied' });
        }
        req.session.user.appliedCoupon = null;
        res.json({ message: 'Coupon removed successfully', coupon });
    } catch (error) {
        console.error('Error in removeCoupon:', error);
        res.status(500).json({ error: 'Failed to remove coupon' });
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
            startingDate,
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

        // Validate date
        const parsedStartingDate = new Date(startingDate);
        const parsedExpiryDate = new Date(expiryDate);
        const now = new Date();

        if (parsedStartingDate < now) {
            return res.status(400).json({
                success: false,
                message: 'Starting date must be in the future'
            });
        }

        if (parsedStartingDate >= parsedExpiryDate) {
            return res.status(400).json({
                success: false,
                message: 'Starting date must be before expiry date'
            });
        }
        if (isNaN(parsedExpiryDate.getTime()) || parsedExpiryDate <= now) {
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
            startingDate: parsedStartingDate,
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
        if(req.body.startingDate) updateData.startingDate = new Date(req.body.startingDate);
        if (req.body.expiryDate) updateData.expiryDate = new Date(req.body.expiryDate);

        if (updateData.startingDate < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Starting date must be in the future'
            });
        }

        if (updateData.startingDate >= updateData.expiryDate) {
            return res.status(400).json({
                success: false,
                message: 'Starting date must be before expiry date'
            });
        }

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
    getAvailableCoupons,
    applyCoupon,
    removeCoupon,
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