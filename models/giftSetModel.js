// models/giftSetModel.js
const mongoose = require('mongoose');

// TẠO MỘT SCHEMA RIÊNG CHO REVIEW (ĐỂ BẬT TIMESTAMPS)
const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    }
}, {
    timestamps: true // Bật timestamps (createdAt, updatedAt) cho sub-document này
});

const giftSetSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: {
        type: String,
        required: true,
        enum: ['Hộp quà rượu vang', 'Quà tặng doanh nghiệp', 'Giỏ quà Tết', 'Phụ kiện quà tặng']
    },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },

    // ✅ Tồn kho set quà
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },

    reviews: [reviewSchema]
}, { timestamps: true });

const GiftSet = mongoose.model('GiftSet', giftSetSchema);

module.exports = GiftSet;
