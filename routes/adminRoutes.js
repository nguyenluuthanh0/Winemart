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
            { $match: { status: 'completed' } }, // Đã chuẩn hóa thành chữ thường
            { $group: { _id: null, total: { $sum: '$amount' } } } // Sử dụng $amount thay vì $totalAmount
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Trả về cả danh sách đã lọc VÀ từ khóa tìm kiếm để hiển thị lại
        res.render('admin/dashboard', { 
            items: allItems, 
            searchTerm: search || '',
            totalOrders: totalOrders,        
            totalProducts: totalProducts,    
            totalRevenue: totalRevenue       
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

// GET /admin/orders -> Hiển thị danh sách đơn hàng (Có tích hợp bộ lọc trạng thái)
router.get('/orders', async (req, res) => {
    try {
        // 1. Lấy trạng thái cần lọc từ URL (Mặc định là 'all' nếu không có)
        const filterStatus = req.query.status || 'all';
        let query = {};

        // 2. Nếu Admin chọn một trạng thái cụ thể, thêm nó vào điều kiện tìm kiếm
        if (filterStatus !== 'all') {
            query.status = filterStatus;
        }

        // 3. Lấy danh sách đơn hàng đã được lọc
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'fullName email phone'); 
        
        // Trả về view kèm theo biến statusFilter để làm sáng option trên giao diện
        res.render('admin/orders', { 
            orders: orders,
            statusFilter: filterStatus 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// POST: Cập nhật trạng thái đơn hàng (ĐÃ FIX LỖI ĐỒNG BỘ VÀ TRÙNG LẶP REDIRECT)
router.post('/orders/update-status', async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;
        
        // Khởi tạo đối tượng lưu các trường cần cập nhật, chuẩn hóa chữ thường
        let updateData = { status: newStatus.toLowerCase().trim() };

        // Nếu Admin xác nhận đơn hàng đã "Hoàn thành" -> Tự động chuyển thành Đã thanh toán
        if (updateData.status === 'completed') {
            updateData.paid = true;
            // Chỉ cập nhật ngày giờ thanh toán nếu trước đó chưa có
            const existingOrder = await Order.findById(orderId);
            if (existingOrder && !existingOrder.paidAt) {
                updateData.paidAt = new Date();
            }
        }

        // Cập nhật vào cơ sở dữ liệu và ép Mongoose trả về bản ghi mới nhất
        await Order.findByIdAndUpdate(
            orderId, 
            { $set: updateData },
            { new: true, runValidators: true }
        );
        
        // Dùng setTimeout chờ DB ghi xong hoàn toàn (200ms) rồi mới load lại trang
        setTimeout(() => {
            res.redirect(req.get('Referrer') || '/admin/orders');
        }, 200);

    } catch (error) {
        console.error("Lỗi khi cập nhật trạng thái:", error);
        res.status(500).send("Lỗi Server");
    }
});

// --- THỐNG KÊ (STATISTICS) ---
router.get('/statistics', async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const selectedVal = req.query.selectedVal;
        const { startDate, endDate } = req.query;
        const currentYear = new Date().getFullYear();

        // 1. LẤY CÁC MỐC THỜI GIAN CÓ DỮ LIỆU ĐỂ HIỂN THỊ TRÊN DROPDOWN
        const availableYearsData = await Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: { $year: "$createdAt" } } }, { $sort: { _id: -1 } }]);
        const availableYears = availableYearsData.map(item => item._id ? item._id.toString() : '');
        const availableMonthsData = await Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: { $dateToString: { format: "%m-%Y", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } } } }, { $sort: { _id: -1 } }]);
        const availableMonths = availableMonthsData.map(item => item._id);
        const availableQuartersData = await Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: { $concat: [{ $toString: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } } }, "-", { $toString: { $year: "$createdAt" } }] } } }, { $sort: { _id: -1 } }]);
        const availableQuarters = availableQuartersData.map(item => item._id);
        const availableWeeksData = await Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: { $concat: [{ $dateToString: { format: "%V", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, "-", { $dateToString: { format: "%Y", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }] } } }, { $sort: { _id: -1 } }]);
        const availableWeeks = availableWeeksData.map(item => item._id);

        let finalSelectedVal = selectedVal;
        if (!finalSelectedVal && !startDate && !endDate) {
            if (period === 'year' && availableYears.length > 0) finalSelectedVal = availableYears[0];
            if (period === 'month' && availableMonths.length > 0) finalSelectedVal = availableMonths[0];
            if (period === 'quarter' && availableQuarters.length > 0) finalSelectedVal = availableQuarters[0];
            if (period === 'week' && availableWeeks.length > 0) finalSelectedVal = availableWeeks[0];
        }

        let matchConditions = { status: 'completed' };
        let activePeriod = period;

        if (startDate && endDate) {
            activePeriod = 'custom';
            matchConditions.createdAt = {
                $gte: new Date(startDate + "T00:00:00.000Z"),
                $lte: new Date(endDate + "T23:59:59.999Z")
            };
        } else if (finalSelectedVal) {
            if (period === 'year') {
                matchConditions.$expr = { $eq: [{ $toString: { $year: "$createdAt" } }, finalSelectedVal] };
            } else if (period === 'month') {
                matchConditions.$expr = { $eq: [{ $dateToString: { format: "%m-%Y", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, finalSelectedVal] };
            } else if (period === 'quarter') {
                matchConditions.$expr = { $eq: [{ $concat: [{ $toString: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } } }, "-", { $toString: { $year: "$createdAt" } }] }, finalSelectedVal] };
            } else if (period === 'week') {
                matchConditions.$expr = { $eq: [{ $concat: [{ $dateToString: { format: "%V", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, "-", { $toString: { $year: "$createdAt" } }] }, finalSelectedVal] };
            }
        } else {
            matchConditions.$expr = { $eq: [{ $year: "$createdAt" }, currentYear] };
        }

        // --- CẬP NHẬT 1: THUẬT TOÁN TÍNH TỔNG LỢI NHUẬN THỰC TẾ ---
        const calculateProfitBlock = {
            $sum: {
                $reduce: {
                    input: { $ifNull: ["$items", []] }, // Đề phòng đơn hàng cũ không có mảng items
                    initialValue: 0,
                    in: {
                        $add: [
                            "$$value",
                            {
                                $multiply: [
                                    { $ifNull: ["$$this.price", 0] },    // Nếu thiếu giá, mặc định là 0
                                    { $ifNull: ["$$this.quantity", 0] }, // Nếu thiếu số lượng, mặc định là 0
                                    {
                                        $cond: [
                                            // Nếu itemModel là Product thì nhân 0.5, ngược lại (Accessory, GiftSet) nhân 0.2
                                            { $eq: ["$$this.itemModel", "Product"] },
                                            0.50, 
                                            0.20  
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };

        const totalOrdersResult = await Order.aggregate([{ $match: matchConditions }, { $count: "count" }]);
        const totalOrders = totalOrdersResult.length > 0 ? totalOrdersResult[0].count : 0;
        
        const financialMetricsResult = await Order.aggregate([
            { $match: matchConditions },
            { 
                $group: { 
                    _id: null, 
                    totalRevenue: { $sum: '$amount' },
                    totalProfit: calculateProfitBlock
                } 
            }
        ]);
        
        const totalRevenue = financialMetricsResult.length > 0 ? financialMetricsResult[0].totalRevenue : 0;
        const totalProfit = financialMetricsResult.length > 0 ? financialMetricsResult[0].totalProfit : 0;
        const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        const orderStatusStats = await Order.aggregate([
            { $match: (startDate && endDate) ? { createdAt: matchConditions.createdAt } : {} },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // --- CẬP NHẬT 2: ÁP DỤNG THUẬT TOÁN LỢI NHUẬN VÀO BIỂU ĐỒ ---
        let groupStage = {};
        if (activePeriod === 'year' || activePeriod === 'quarter') {
            groupStage = {
                $group: {
                    _id: { $dateToString: { format: "Tháng %m", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
                    revenue: { $sum: '$amount' },
                    profit: calculateProfitBlock
                }
            };
        } else {
            groupStage = {
                $group: {
                    _id: { $dateToString: { format: "%d-%m-%Y", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
                    revenue: { $sum: '$amount' },
                    profit: calculateProfitBlock
                }
            };
        }

        const periodStats = await Order.aggregate([
            { $match: matchConditions },
            groupStage,
            { $sort: { '_id': 1 } }
        ]);

        res.render('admin/statistics', {
            totalOrders, totalRevenue, totalProfit, averageOrderValue,
            orderStatusStats: JSON.stringify(orderStatusStats),
            periodStats: JSON.stringify(periodStats),
            period: activePeriod,
            selectedVal: finalSelectedVal || '',
            startDate: startDate || '', endDate: endDate || '',
            availableYears, availableMonths, availableQuarters, availableWeeks, currentYear
        });

    } catch (error) {
        console.error("Lỗi trang thống kê:", error);
        res.status(500).send("Lỗi Server");
    }
});

// GET: Hiển thị chi tiết một đơn hàng cụ thể
router.get('/order-detail/:id', async (req, res) => {
    try {
        const orderId = req.params.id;

        // Tìm đơn hàng theo ID, nạp thêm thông tin tài khoản (user) và chi tiết từng sản phẩm trong mảng items
        const order = await Order.findById(orderId)
            .populate('user')
            .populate('items.item'); // Tự động map linh hoạt sang bảng Product/Accessory/GiftSet nhờ refPath

        if (!order) {
            return res.status(404).send("Không tìm thấy đơn hàng này trong hệ thống.");
        }

        // Trả dữ liệu về giao diện chi tiết đơn hàng
        res.render('admin/order-detail', { order });
    } catch (error) {
        console.error("Lỗi khi tải chi tiết đơn hàng:", error);
        res.status(500).send("Lỗi hệ thống");
    }
});

module.exports = router;