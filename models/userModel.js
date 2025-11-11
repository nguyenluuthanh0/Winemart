// models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Vui lòng nhập email'],
        unique: true, // Đảm bảo mỗi email là duy nhất
        lowercase: true, // Luôn chuyển email về chữ thường
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Vui lòng nhập mật khẩu'],
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
    },
    role: { 
        type: String,
        enum: ['user', 'admin'], // Chỉ cho phép 2 giá trị này
        default: 'user'         // Mặc định mọi tài khoản mới là 'user'
    },
    cart: [ // Là một mảng các sản phẩm trong giỏ
        {
            item: { // ID của sản phẩm (có thể là Product, Accessory, hoặc GiftSet)
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                refPath: 'cart.itemModel' // Tham chiếu động đến Model tương ứng
            },
            itemModel: { // Tên của Model ('Product', 'Accessory', 'GiftSet')
                type: String,
                required: true,
                enum: ['Product', 'Accessory', 'GiftSet']
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
                default: 1
            }
        }
    ],
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationCode: {
        type: String,
    },
    emailVerificationExpires: {
        type: Date,
    }
});

// Hash mật khẩu trước khi lưu vào database
// Đây là một Mongoose middleware, nó sẽ tự động chạy trước sự kiện 'save'
userSchema.pre('save', async function(next) {
    // Chỉ hash mật khẩu nếu nó vừa được tạo mới hoặc bị thay đổi
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10); // Tạo "muối" để tăng độ an toàn
        this.password = await bcrypt.hash(this.password, salt); // Băm mật khẩu
        next();
    } catch (error) {
        next(error);
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;