// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/userModel');

const Product = require('../models/productModel');
const Accessory = require('../models/accessoryModel');
const GiftSet = require('../models/giftSetModel');
const jwt = require('jsonwebtoken'); 
const { sendOTPEmail } = require('../utils/mailService');
const crypto = require('crypto');
const Order = require('../models/orderModel');
const { requireLogin } = require('../middleware/authMiddleware');

// HÀM HELPER ĐỂ "THOÁT" CÁC KÝ TỰ ĐẶC BIỆT TRONG REGEX
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// HIỂN THỊ TRANG CHỦ
router.get('/', (req, res) => {
    res.render('index');
});

// HIỂN THỊ TRANG GIỎ HÀNG
router.get('/cart', (req, res) => {
    res.render('cart');
});

// XỬ LÝ VIỆC ĐĂNG KÝ
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        if (!normalizedEmail.includes('@')) {
            req.session.errorMessage = 'Vui lòng đăng ký bằng Email hợp lệ.';
            return res.redirect('/register');
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const expires = Date.now() + 10 * 60 * 1000; // 10 phút

        let user = await User.findOne({ email: normalizedEmail });

        if (user) {
            if (!user.isVerified) {
                user.password = password; 
                user.emailVerificationCode = otp;
                user.emailVerificationExpires = expires;
                await user.save();
            } else {
                req.session.errorMessage = 'Email này đã được sử dụng.';
                return res.redirect('/register');
            }
        } else {
            user = new User({ 
                email: normalizedEmail, 
                password,
                emailVerificationCode: otp,
                emailVerificationExpires: expires,
                isVerified: false 
            });
            await user.save();
        }
        
        await sendOTPEmail(user.email, otp);

        req.session.verificationEmail = user.email;
        
        res.redirect('/verify-otp'); 

    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        res.redirect('/register');
    }
});


// XỬ LÝ VIỆC ĐĂNG NHẬP
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body; 
        const normalizedEmail = email.toLowerCase().trim(); 
        const user = await User.findOne({ email: normalizedEmail }); 

        if (!user || !(await bcrypt.compare(password, user.password))) {
            req.session.errorMessage = 'Email hoặc mật khẩu không chính xác.'; 
            return res.redirect('/login');
        }

        // === KIỂM TRA MỚI: ĐÃ KÍCH HOẠT CHƯA? ===
        if (!user.isVerified) {
            req.session.errorMessage = 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email của bạn.';
            return res.redirect('/login');
        }
        
        req.session.userId = user._id;
        res.redirect('/');

    } catch (error) {
        console.error(error);
        req.session.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        res.redirect('/login');
    }
});

// HIỂN THỊ TRANG ĐĂNG KÝ
router.get('/register', (req, res) => {
    // Đọc và xóa thông báo lỗi khỏi session để nó chỉ hiện 1 lần
    const errorMessage = req.session.errorMessage;
    delete req.session.errorMessage;
    res.render('register', { errorMessage });
});

// HIỂN THỊ TRANG ĐĂNG NHẬP
router.get('/login', (req, res) => {
    // Đọc và xóa thông báo lỗi/thành công khỏi session
    const errorMessage = req.session.errorMessage;
    delete req.session.errorMessage;
    const successMessage = req.session.successMessage;
    delete req.session.successMessage;
    res.render('login', { errorMessage, successMessage });
});

// XỬ LÝ ĐĂNG XUẤT
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Xóa cookie session
        res.redirect('/');
    });
});

router.get('/', (req, res) => {
    res.render('index');
});
router.get('/cart', (req, res) => {
    res.render('cart');
});


// GET /contact -> Hiển thị trang liên hệ
router.get('/contact', (req, res) => {
    const successMessage = req.session.successMessage;
    delete req.session.successMessage; // Xóa để không hiển thị lại
    res.render('contact', { successMessage });
});

// POST /contact -> Nhận dữ liệu từ form liên hệ
router.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    
    // Ở đây, trong một ứng dụng thực tế, bạn sẽ gửi email
    // Ví dụ: Gửi email đến admin bằng Nodemailer
    // Nhưng để đơn giản, chúng ta sẽ chỉ hiển thị một thông báo thành công
    console.log('--- Tin nhắn liên hệ mới ---');
    console.log(`Từ: ${name} (${email})`);
    console.log(`Nội dung: ${message}`);
    
    // Lưu thông báo thành công vào session và chuyển hướng
    req.session.successMessage = "Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.";
    res.redirect('/contact');
});

// THÊM ROUTE MỚI CHO TRANG LỊCH SỬ ĐƠN HÀNG
router.get('/my-orders', requireLogin, async (req, res) => {
    try {
        const ordersFromDb = await Order.find({ user: req.session.userId })
                                          .sort({ createdAt: -1 });
        
        // Thời điểm 2 giờ trước
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

        // Xử lý lại trạng thái
        const orders = ordersFromDb.map(order => {
            // Nếu là đơn COD, đang xử lý, VÀ đã tạo được hơn 2 giờ
            if (order.paymentMethod === 'cod' && 
                order.status === 'processing' && 
                order.createdAt.getTime() < twoHoursAgo) 
            {
                // Chỉ "giả lập" trạng thái là 'completed' để hiển thị
                // Chúng ta không thay đổi database ở đây
                return { ...order.toObject(), status: 'completed' };
            }
            return order; // Trả về đơn hàng gốc
        });
        
        res.render('my-orders', { orders: orders });

    } catch (error) {
        console.error("Lỗi khi lấy lịch sử đơn hàng:", error);
        res.redirect('/');
    }
});
// ==========================================================
// THÊM ROUTE MỚI CHO TÌM KIẾM TOÀN TRANG
// ==========================================================
router.get('/search', async (req, res) => {
    try {
        // Lấy từ khóa tìm kiếm từ URL (?q=...)
        const queryTerm = req.query.q;

        // Nếu không có từ khóa, quay về trang chủ
        if (!queryTerm) {
            return res.redirect('/');
        }

        const escapedQuery = escapeRegex(queryTerm);
        const searchQuery = { name: { $regex: escapedQuery, $options: 'i' } };

        // Tìm kiếm song song trong cả 3 collections
        const productsPromise = Product.find(searchQuery);
        const accessoriesPromise = Accessory.find(searchQuery);
        const giftSetsPromise = GiftSet.find(searchQuery);

        const [products, accessories, giftSets] = await Promise.all([
            productsPromise,
            accessoriesPromise,
            giftSetsPromise
        ]);

        // Gộp tất cả kết quả lại
        const results = [...products, ...accessories, ...giftSets];

        // Tạo breadcrumbs
        const breadcrumbs = [
            { name: "Trang Chủ", link: "/" },
            { name: `Tìm kiếm cho: "${queryTerm}"`, link: "" }
        ];

        // Render ra một trang EJS mới để hiển thị kết quả
        res.render('search-results', {
            results: results,
            queryTerm: queryTerm,
            breadcrumbs: breadcrumbs
        });

    } catch (error) {
        console.error("Lỗi khi tìm kiếm:", error);
        res.status(500).send("Server Error");
    }
});
// GET /verify-otp -> Hiển thị trang nhập OTP
router.get('/verify-otp', (req, res) => {
    const email = req.session.verificationEmail;
    if (!email) {
        // Nếu không có email trong session, không biết xác thực cho ai
        return res.redirect('/register');
    }

    const error = req.session.errorMessage;
    delete req.session.errorMessage;
    res.render('verify-otp', { email, error });
});

// POST /verify-otp -> Xử lý mã OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.verificationEmail;

        if (!email) {
            return res.redirect('/register');
        }

        const user = await User.findOne({ email: email });

        // Kiểm tra
        if (!user) {
            req.session.errorMessage = "Đã có lỗi xảy ra, vui lòng đăng ký lại.";
            return res.redirect('/verify-otp');
        }
        if (user.emailVerificationCode !== otp) {
            req.session.errorMessage = "Mã OTP không chính xác.";
            return res.redirect('/verify-otp');
        }
        if (user.emailVerificationExpires < Date.now()) {
            req.session.errorMessage = "Mã OTP đã hết hạn. Vui lòng đăng ký lại để nhận mã mới.";
            return res.redirect('/verify-otp');
        }

        // Xác thực thành công
        user.isVerified = true;
        user.emailVerificationCode = undefined; // Xóa mã OTP
        user.emailVerificationExpires = undefined; // Xóa thời gian hết hạn
        await user.save();

        // Xóa email khỏi session
        delete req.session.verificationEmail;

        req.session.successMessage = 'Kích hoạt tài khoản thành công! Bạn có thể đăng nhập.';
        res.redirect('/login');

    } catch (error) {
        console.error("Lỗi xác thực OTP:", error);
        req.session.errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        res.redirect('/verify-otp');
    }
});
module.exports = router;