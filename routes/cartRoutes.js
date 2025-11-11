const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Accessory = require('../models/accessoryModel');
const GiftSet = require('../models/giftSetModel');
const mongoose = require('mongoose');

// Middleware kiểm tra đăng nhập
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Vui lòng đăng nhập' });
    }
    next();
};

// Hàm helper xác định Model Type (đã sửa lỗi)
async function determineItemModel(itemId) {
    if (!mongoose.Types.ObjectId.isValid(itemId)) return null; // Kiểm tra ID hợp lệ
    
    // Kiểm tra song song để nhanh hơn
    const [isProduct, isAccessory, isGiftSet] = await Promise.all([
        Product.findById(itemId).countDocuments(),
        Accessory.findById(itemId).countDocuments(),
        GiftSet.findById(itemId).countDocuments()
    ]);

    if (isProduct) return 'Product';
    if (isAccessory) return 'Accessory';
    if (isGiftSet) return 'GiftSet';
    return null;
}

// ==========================================
// API MỚI: LẤY SỐ LƯỢNG ITEM TRÊN HEADER
// ==========================================
router.get('/count', requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }
        // Tính tổng số lượng
        const count = user.cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ count });
    } catch (error) {
        console.error("Lỗi khi đếm giỏ hàng:", error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ==========================================
// API MỚI: LẤY CHI TIẾT GIỎ HÀNG (ĐÃ SỬA)
// ==========================================
router.get('/items', requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate({
            path: 'cart.item',
            // model: (doc) => doc.cart.itemModel // Bị lỗi ở đây
            // Thay thế bằng cách populate thủ công (an toàn hơn)
            // Hoặc đảm bảo các model đã được require ở đầu file (đã làm)
        });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        // Cần populate thủ công để dùng refPath chính xác
        await User.populate(user, { path: 'cart.item' });
        
        let totalAmount = 0;
        const count = user.cart.reduce((sum, item) => sum + item.quantity, 0);

        const cartDetails = user.cart.map(cartItem => {
            if (cartItem.item) {
                const subtotal = cartItem.item.price * cartItem.quantity;
                totalAmount += subtotal;
                return {
                    _id: cartItem.item._id,
                    name: cartItem.item.name,
                    imageUrl: cartItem.item.imageUrl,
                    price: cartItem.item.price,
                    quantity: cartItem.quantity,
                    subtotal: subtotal,
                    itemModel: cartItem.itemModel // Trả về itemModel
                };
            }
            return null;
        }).filter(item => item !== null);

        // Trả về count, items và totalAmount
        res.json({ items: cartDetails, totalAmount, count });

    } catch (error) {
        console.error("Lỗi khi lấy giỏ hàng:", error);
        res.status(500).json({ message: 'Lỗi server khi lấy giỏ hàng.' });
    }
});


// ==========================================
// API THÊM VÀO GIỎ HÀNG (ĐÃ SỬA)
// ==========================================
router.post('/add', requireLogin, async (req, res) => {
    const { itemId, itemType, quantity = 1 } = req.body; // Nhận cả itemType từ frontend
    const userId = req.session.userId;

    if (!itemId || !itemType) {
        return res.status(400).json({ message: 'Thiếu ID sản phẩm hoặc loại sản phẩm.' });
    }
    if (!['Product', 'Accessory', 'GiftSet'].includes(itemType)) {
         return res.status(400).json({ message: 'Loại sản phẩm không hợp lệ.' });
    }

    try {
        const user = await User.findById(userId);
        const existingItemIndex = user.cart.findIndex(cartItem => cartItem.item.toString() === itemId);

        if (existingItemIndex > -1) {
            user.cart[existingItemIndex].quantity += quantity;
        } else {
            user.cart.push({ item: itemId, itemModel: itemType, quantity: quantity });
        }

        await user.save();
        
        const newCartCount = user.cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ message: 'Đã thêm vào giỏ hàng!', newCartCount });

    } catch (error) {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        res.status(500).json({ message: 'Lỗi server khi thêm vào giỏ hàng.' });
    }
});

// ==========================================
// API XÓA KHỎI GIỎ HÀNG (ĐÃ SỬA)
// ==========================================
router.post('/remove', requireLogin, async (req, res) => {
    const { itemId } = req.body;
    const userId = req.session.userId;

    try {
        const user = await User.findById(userId);
        
        // Lọc ra các item không phải item bị xóa
        user.cart = user.cart.filter(cartItem => cartItem.item.toString() !== itemId);
        
        await user.save();

        const newCartCount = user.cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ message: 'Đã xóa sản phẩm.', newCartCount });

    } catch (error) {
        console.error("Lỗi khi xóa khỏi giỏ hàng:", error);
        res.status(500).json({ message: 'Lỗi server khi xóa khỏi giỏ hàng.' });
    }
});

// ==========================================
// API CẬP NHẬT SỐ LƯỢNG (ĐÃ SỬA)
// ==========================================
router.post('/update', requireLogin, async (req, res) => {
    const { itemId, quantity } = req.body;
    const userId = req.session.userId;
    const newQuantity = parseInt(quantity);

    if (newQuantity <= 0) {
        // Nếu số lượng <= 0, coi như xóa
        return router.handle({ method: 'POST', url: '/remove', body: { itemId }, session: req.session }, res);
    }

    try {
        const user = await User.findById(userId);
        const itemIndex = user.cart.findIndex(cartItem => cartItem.item.toString() === itemId);

        if (itemIndex > -1) {
            user.cart[itemIndex].quantity = newQuantity;
            await user.save();
            const newCartCount = user.cart.reduce((sum, item) => sum + item.quantity, 0);
            res.json({ message: 'Đã cập nhật số lượng.', newCartCount });
        } else {
            res.status(404).json({ message: 'Sản phẩm không có trong giỏ hàng.' });
        }
    } catch (error) {
        console.error("Lỗi khi cập nhật giỏ hàng:", error);
        res.status(500).json({ message: 'Lỗi server khi cập nhật giỏ hàng.' });
    }
});


module.exports = router;