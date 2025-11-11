// models/orderModel.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Dùng orderId của chúng ta thay vì _id của Mongo để gửi cho VNPay
    orderId: { type: String, required: true, unique: true }, 

    // Người dùng đã đăng nhập (nếu có)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 

    // Thông tin khách hàng
    customerInfo: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true }
    },

    // Các sản phẩm trong đơn hàng
    items: [
        {
            item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'items.itemModel' },
            itemModel: { type: String, required: true, enum: ['Product', 'Accessory', 'GiftSet'] },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true } // Giá tại thời điểm đặt hàng
        }
    ],

    amount: { type: Number, required: true }, // Tổng số tiền

    paymentMethod: {
        type: String,
        required: true,
        enum: ['cod', 'vnpay']
    },

    // Trạng thái đơn hàng
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
        default: 'pending' // Mới tạo sẽ là "chờ thanh toán"
    },

    paymentInfo: { type: Object } // Lưu thông tin trả về từ VNPay
}, { timestamps: true }); // Tự động thêm createdAt và updatedAt

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;