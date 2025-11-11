// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const moment = require('moment');
const net = require('net');
const querystring = require('qs');

const Order = require('../models/orderModel');
const User = require('../models/userModel');
const { requireLogin } = require('../middleware/authMiddleware');

// === HÀM sortObject CHUẨN TỪ VNPAY DEMO ===
// Hàm này sắp xếp các key VÀ mã hóa (encode) các giá trị
function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();

    keys.forEach((key) => {
        if (typeof obj[key] === 'undefined' || obj[key] === null) {
            return;
        }
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
    });
    return sorted;
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = (typeof forwarded === 'string' && forwarded.split(',')[0].trim())
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || req.connection?.socket?.remoteAddress
        || '';

    if (!rawIp) {
        return '127.0.0.1';
    }

    if (rawIp.startsWith('::ffff:')) {
        return rawIp.substring(7);
    }
    if (rawIp === '::1' || rawIp === '0:0:0:0:0:0:0:1') {
        return '127.0.0.1';
    }
    if (net.isIP(rawIp) === 6) {
        // VNPay yêu cầu IPv4, nếu nhận IPv6 thì trả về 127.0.0.1 để tránh lỗi 99
        return '127.0.0.1';
    }

    return rawIp;
}
// VNPay chỉ chấp nhận vnp_TxnRef tối đa 20 ký tự dạng chữ/ số.
function generateOrderId() {
    const datePart = moment().format('YYMMDDHHmmss');
    const randomPart = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    return (datePart + randomPart).substring(0, 20);
}

// === CÁC ROUTE CHÍNH ===

// GET /order/checkout
router.get('/checkout', requireLogin, (req, res) => {
    res.render('checkout');
});

// POST /order/create-payment (ĐÃ SỬA LỖI CHỮ KÝ)
router.post('/create-payment', requireLogin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate('cart.item');
        if (!user || user.cart.length === 0) {
            return res.redirect('/cart');
        }
        
        const customerInfo = { name: req.body.name, phone: req.body.phone, address: req.body.address };
        const paymentMethod = req.body.paymentMethod;
        let amount = 0;
        const items = user.cart.map(cartItem => {
            if (!cartItem.item) throw new Error("Sản phẩm trong giỏ hàng không hợp lệ.");
            const itemPrice = cartItem.item.price;
            amount += itemPrice * cartItem.quantity;
            return {
                item: cartItem.item._id,
                itemModel: cartItem.itemModel,
                quantity: cartItem.quantity,
                price: itemPrice
            };
        });

        const order = new Order({
            orderId: generateOrderId(),
            user: req.session.userId,
            customerInfo,
            items,
            amount,
            paymentMethod: paymentMethod,
            status: 'pending'
        });
        await order.save();
        
        if (paymentMethod === 'cod') {
            order.status = 'processing';
            await order.save();
            user.cart = [];
            await user.save();
            return res.render('order-success', { message: "Đặt hàng thành công! Bạn sẽ thanh toán khi nhận hàng." });
        }

        if (paymentMethod === 'vnpay') {            
            const tmnCode = process.env.VNPAY_TMNCODE;
            const secretKey = process.env.VNPAY_HASHSECRET;
            let vnpUrl = process.env.VNPAY_URL;
            if (!tmnCode || !secretKey || !vnpUrl) {
                throw new Error('Thiếu cấu hình VNPay (VNPAY_TMNCODE, VNPAY_HASHSECRET hoặc VNPAY_URL)');
            }
            const ipAddr = getClientIp(req);           
            // Lấy URL ngrok của bạn (hãy đảm bảo nó là URL https)
            const returnUrl = process.env.VNPAY_RETURNURL || "https://parker-tritheistical-glancingly.ngrok-free.dev/order/vnpay_return";
            const ipnUrl = process.env.VNPAY_IPNURL || "https://parker-tritheistical-glancingly.ngrok-free.dev/order/vnpay_ipn";
            if (!returnUrl.startsWith('https://') || !ipnUrl.startsWith('https://')) {
                throw new Error('VNPay yêu cầu ReturnUrl và IpnUrl phải là HTTPS công khai.');
            }
            const createDate = moment().utcOffset(7 * 60).format('YYYYMMDDHHmmss');
            const expireDate = moment().utcOffset(7 * 60).add(15, 'minutes').format('YYYYMMDDHHmmss');
            
            let vnp_Params = {};
            vnp_Params['vnp_Version'] = '2.1.0';
            vnp_Params['vnp_Command'] = 'pay';
            vnp_Params['vnp_TmnCode'] = tmnCode;
            vnp_Params['vnp_Locale'] = 'vn';
            vnp_Params['vnp_CurrCode'] = 'VND';
            vnp_Params['vnp_TxnRef'] = order.orderId;
            vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + order.orderId;
            vnp_Params['vnp_OrderType'] = 'other';
            vnp_Params['vnp_Amount'] = Math.round(amount * 100).toString();
            vnp_Params['vnp_ReturnUrl'] = returnUrl;
            vnp_Params['vnp_IpAddr'] = ipAddr;
            vnp_Params['vnp_CreateDate'] = createDate;
            vnp_Params['vnp_IpnUrl'] = ipnUrl; // Thêm IPN URL
            vnp_Params['vnp_ExpireDate'] = expireDate;
            // BƯỚC 1: Sắp xếp và mã hóa các tham số (Giống hệt demo)
            vnp_Params = sortObject(vnp_Params);

            // BƯỚC 2: Tạo chuỗi signData (Giống hệt demo)
            let signData = querystring.stringify(vnp_Params, { encode: false });
            
            // BƯỚC 3: Tạo chữ ký (Giống hệt demo)
            let hmac = crypto.createHmac("sha512", secretKey);
            // Dùng Buffer.from thay vì 'new Buffer' (đã cũ)
            let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
            vnp_Params['vnp_SecureHash'] = signed;

            // BƯỚC 4: Thêm chữ ký vào URL (Giống hệt demo)
            vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
            
            res.redirect(vnpUrl);
        }

    } catch (error) {
        console.error("Lỗi khi tạo thanh toán:", error);
        res.status(500).send("Đã có lỗi xảy ra");
    }
});

// GET /order/vnpay_return (SỬA LỖI CHỮ KÝ)
router.get('/vnpay_return', async (req, res) => {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params); // Dùng hàm sortObject chuẩn
    
    const secretKey = process.env.VNPAY_HASHSECRET;
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
        const resultCode = vnp_Params['vnp_ResponseCode'];
        if (resultCode === '00') {
            res.render('order-success', { message: "Thanh toán thành công! Đơn hàng của bạn đang được xử lý." });
        } else {
            res.render('order-success', { message: "Thanh toán thất bại. Vui lòng thử lại." });
        }
    } else {
        res.render('order-success', { message: "Giao dịch không hợp lệ (chữ ký không khớp)." });
    }
});
    
// GET /order/vnpay_ipn (SỬA LỖI CHỮ KÝ)
router.get('/vnpay_ipn', async (req, res) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params); // Dùng hàm sortObject chuẩn

    let secretKey = process.env.VNPAY_HASHSECRET;
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
        const orderId = vnp_Params['vnp_TxnRef'];
        const resultCode = vnp_Params['vnp_ResponseCode'];
        const amount = parseInt(vnp_Params['vnp_Amount']) / 100; // ParseInt cho an toàn

        try {
            const order = await Order.findOne({ orderId: orderId });
            if (order) {
                // Kiểm tra logic giống demo
                if(order.status !== 'pending'){ // 'pending' là 0
                    return res.status(200).json({RspCode: '02', Message: 'This order has been updated to the payment status'});
                }
                if (order.amount !== amount) {
                    return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
                }
                
                if (resultCode === '00') {
                    order.status = 'completed'; // '1'
                    order.paymentInfo = vnp_Params;
                    await order.save();
                    await User.findByIdAndUpdate(order.user, { $set: { cart: [] } });
                    res.status(200).json({ RspCode: '00', Message: 'success' });
                } else {
                    order.status = 'failed'; // '2'
                    order.paymentInfo = vnp_Params;
                    await order.save();
                    res.status(200).json({ RspCode: '00', Message: 'success' }); // Vẫn trả về success
                }
            } else {
                res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }
        } catch (error) {
            console.error("Lỗi xử lý IPN:", error);
            res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
        }
    } else {
        res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
    }
});

// Route xem chi tiết đơn hàng (Dành cho trang "Đơn hàng của tôi")
router.get('/detail/:orderId', requireLogin, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            user: req.session.userId 
        }).populate('items.item');

        if (!order) {
            return res.redirect('/my-orders');
        }

        // Xử lý logic 2 giờ
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        if (order.paymentMethod === 'cod' && 
            order.status === 'processing' && 
            order.createdAt.getTime() < twoHoursAgo) 
        {
            order.status = 'completed'; // Sửa lại trạng thái trước khi render
        }

        res.render('order-status', { order });

    } catch (error) {
        console.error("Lỗi khi xem chi tiết đơn hàng:", error);
        res.redirect('/my-orders');
    }
});

module.exports = router;