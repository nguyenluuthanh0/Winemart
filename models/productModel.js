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

// Định nghĩa Schema cho sản phẩm
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // Tên sản phẩm là bắt buộc
        trim: true // Xóa khoảng trắng thừa
    },
    brand: {
        type: String,
        required: true,
    },
    origin: {
        type: String, // Ví dụ: "Chile", "Pháp"
        required: true
    },
    type: {
        type: String, // Ví dụ: "Vang đỏ", "Vang trắng"
        required: true
    },
    description: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String, // Đường dẫn tới hình ảnh sản phẩm
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0 // Giá không thể âm
    },
    volume: {
        type: Number, // Dung tích, ví dụ: 750 (ml)
        required: true
    },
    vintage: { 
        type: Number, 
        default: null // Năm sản xuất
    },
    grape: { 
        type: String, 
        default: ''   // Giống nho
    },
    abv: { 
        type: Number, 
        default: null // Nồng độ cồn (%)
    },
    region: {
        type: String,
        default: '' // Vùng làm vang
    },
    tastingNotes: {
        type: String,
        default: '' // Hương vị đặc trưng
    },
    foodPairing: {
        type: String,
        default: '' // Gợi ý kết hợp món ăn
    },

    // ✅ Tồn kho rượu
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    inStock: {
        type: Boolean,
        default: false
    },

    reviews: [reviewSchema]
}, {
    timestamps: true // Tự động thêm 2 trường: createdAt và updatedAt
});

// Middleware: Tự động cập nhật inStock trước khi lưu vào DB
productSchema.pre('save', function(next) {
    // Nếu số lượng > 0 thì inStock là true, ngược lại là false
    this.inStock = this.stock > 0;
    next();
});

// Tạo Model từ Schema
const Product = mongoose.model('Product', productSchema);

// Xuất Model để các file khác có thể sử dụng
module.exports = Product;
