// Import các thư viện cần thiết
const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Tải các biến môi trường từ file .env
dotenv.config();

// Khởi tạo ứng dụng Express
const app = express();
// CẤU HÌNH VIEW ENGINE LÀ EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const port = process.env.PORT || 5000;

// Import routes
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes'); 
const adminRoutes = require('./routes/adminRoutes');
const itemRoutes = require('./routes/itemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
// Middleware để Express có thể đọc được JSON từ body của request
app.use(express.json());

// Middleware để đọc dữ liệu từ form
app.use(express.urlencoded({ extended: true }));

// Cấu hình Session
app.use(session({
    secret: process.env.SESSION_SECRET, // Lấy chuỗi bí mật từ file .env
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI 
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Cookie hết hạn sau 1 ngày
    }
}));

// Kết nối tới MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('Đã kết nối thành công tới MongoDB!');
})
.catch((err) => {
    console.error('Lỗi kết nối MongoDB:', err);
});

// Định nghĩa một route cơ bản để kiểm tra server
app.get('/api', (req, res) => {
    res.send('Chào mừng tới API của Wine Shop!');
});

// Phục vụ các file tĩnh từ thư mục 'public'
// Khi người dùng truy cập trang chủ, server sẽ gửi file index.html
app.use(express.static('public'));

const User = require('./models/userModel');


// Middleware để lấy thông tin user cho tất cả các view
app.use(async (req, res, next) => {
    if (req.session.userId) {
        res.locals.currentUser = await User.findById(req.session.userId);
    } else {
        res.locals.currentUser = null;
    }
    next();
});

// Sử dụng routes
app.use('/products', productRoutes);
app.use('/admin', adminRoutes);
app.use('/items', itemRoutes);
app.use('/order', orderRoutes);
app.use('/cart', cartRoutes);
app.use('/', userRoutes);



// Lắng nghe các kết nối trên port đã định
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});