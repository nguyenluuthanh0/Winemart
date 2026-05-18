// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const Product = require('../models/productModel');
const { isAdmin } = require('../middleware/authMiddleware');
const Accessory = require('../models/accessoryModel'); 
const GiftSet = require('../models/giftSetModel');   
const Order = require('../models/orderModel');

// Áp dụng middleware isAdmin cho TẤT CẢ các route trong file này
router.use(isAdmin);

// GET /admin -> Hiển thị trang dashboard VỚI CHỨC NĂNG TÌM KIẾM
router.get('/', async (req, res) => {
    try {
        // Lấy từ khóa tìm kiếm từ URL query
        const { search } = req.query;
        let filterQuery = {};

        // Nếu có từ khóa tìm kiếm, tạo một điều kiện lọc bằng regex
        if (search) {
            filterQuery = { name: { $regex: search, $options: 'i' } };
        }

        // Áp dụng điều kiện lọc (filterQuery) khi tìm kiếm trong cả 3 collection
        const productsPromise = Product.find(filterQuery);
        const accessoriesPromise = Accessory.find(filterQuery);
        const giftSetsPromise = GiftSet.find(filterQuery);

        const [products, accessories, giftSets] = await Promise.all([
            productsPromise,
            accessoriesPromise,
            giftSetsPromise,
        ]);

        const allItems = [...products, ...accessories, ...giftSets];
        allItems.sort((a, b) => b.createdAt - a.createdAt);

        // THÊM MỚI: Truy vấn dữ liệu thống kê
        const totalOrders = await Order.countDocuments();
        const totalProducts = allItems.length;
        
        // Tính tổng doanh thu từ các đơn hàng 'Completed' (Hoàn thành)
        const revenueResult = await Order.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Trả về cả danh sách đã lọc VÀ từ khóa tìm kiếm để hiển thị lại
        res.render('admin/dashboard', { 
            items: allItems, 
            searchTerm: search || '' 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// GET /admin/add-product -> Hiển thị form thêm sản phẩm MỚI (tổng quát)
router.get('/add-product', (req, res) => {
    res.render('admin/add-product');
});

// POST /admin/add-item -> Xử lý việc thêm mọi loại sản phẩm
router.post('/add-item', async (req, res) => {
    try {
        const { itemType, name, description, imageUrl, price } = req.body;

        let newItem;
        if (itemType === 'product') {
            const { brand, origin, type, volume } = req.body;
            newItem = new Product({ name, description, imageUrl, price, brand, origin, type, volume });
        } else if (itemType === 'accessory') {
            const category = req.body.categoryAccessory;
            newItem = new Accessory({ name, description, imageUrl, price, category });
        } else if (itemType === 'giftset') {
            const category = req.body.categoryGiftSet;
            newItem = new GiftSet({ name, description, imageUrl, price, category });
        }

        if (newItem) {
            await newItem.save();
        }
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
    }
});

// POST /admin/add-product -> Xử lý việc thêm sản phẩm mới
router.post('/add-product', async (req, res) => {
    try {
        const { name, brand, origin, type, description, imageUrl, price, volume } = req.body;
        const newProduct = new Product({ name, brand, origin, type, description, imageUrl, price, volume });
        await newProduct.save();
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        // Xử lý lỗi
    }
});

// Hàm helper để lấy Model dựa trên type
const getModelByType = (type) => {
    if (type === 'product') return Product;
    if (type === 'accessory') return Accessory;
    if (type === 'giftset') return GiftSet;
    return null;
};
// GET /admin/edit-item/:type/:id -> Hiển thị form để sửa một item cụ thể
router.get('/edit-item/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const Model = getModelByType(type);
        if (!Model) {
            return res.status(404).send('Loại sản phẩm không hợp lệ');
        }

        const item = await Model.findById(id);
        if (!item) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        res.render('admin/edit-item', { item, itemType: type });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
// POST /admin/edit-item/:type/:id -> Xử lý việc cập nhật item
router.post('/edit-item/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const Model = getModelByType(type);
        if (Model) {
            // req.body chứa toàn bộ dữ liệu mới từ form
            await Model.findByIdAndUpdate(id, req.body);
        }
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
// POST /admin/delete-item/:type/:id -> Xóa mọi loại sản phẩm
router.post('/delete-item/:type/:id', async (req, res) => {
    try {
        const Model = getModelByType(req.params.type);
        if (Model) {
            await Model.findByIdAndDelete(req.params.id);
        }
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;

// GET /admin/orders -> Hiển thị danh sách đơn hàng
router.get('/orders', async (req, res) => {
    try {
        // Lấy tất cả đơn hàng, đơn mới nhất lên đầu, lấy thêm thông tin người mua (email, fullName)
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'fullName email phone'); 
        
        res.render('admin/orders', { orders });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// POST /admin/orders/update-status -> Cập nhật trạng thái
router.post('/orders/update-status', async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;
        await Order.findByIdAndUpdate(orderId, { status: newStatus });
        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});