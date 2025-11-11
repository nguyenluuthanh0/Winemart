// routes/itemRoutes.js
const express = require('express');
const router = express.Router();

// Import các model cần thiết
const Product = require('../models/productModel');
const Accessory = require('../models/accessoryModel');
const GiftSet = require('../models/giftSetModel');

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Hàm helper để lấy Model dựa trên type
const getModelByType = (type) => {
    if (type === 'product') return Product;
    if (type === 'accessory') return Accessory;
    if (type === 'giftset') return GiftSet;
    return null;
};

// GET /items/detail/:type/:id -> Route để xem chi tiết MỌI loại sản phẩm
router.get('/detail/:type/:id', async (req, res) => {
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

        // Render ra một view chung cho tất cả các loại item
        res.render('item-detail', { item });

    } catch (error) {
        console.error("Lỗi khi xem chi tiết sản phẩm:", error);
        res.status(500).send("Server Error");
    }
});

// POST /items/cart-details -> Lấy thông tin chi tiết cho các item trong giỏ hàng
router.post('/cart-details', async (req, res) => {
    try {
        const ids = req.body.ids; // Nhận mảng các ID từ request body
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json([]); // Trả về mảng rỗng nếu không có ID
        }

        // Tìm kiếm song song trong cả 3 collections
        const productsPromise = Product.find({ '_id': { $in: ids } }).lean(); // .lean() để trả về plain JS object
        const accessoriesPromise = Accessory.find({ '_id': { $in: ids } }).lean();
        const giftSetsPromise = GiftSet.find({ '_id': { $in: ids } }).lean();

        const [products, accessories, giftSets] = await Promise.all([
            productsPromise,
            accessoriesPromise,
            giftSetsPromise
        ]);

        // Gộp kết quả lại
        const allItems = [...products, ...accessories, ...giftSets];

        // Tạo một map để dễ dàng sắp xếp lại theo thứ tự ID ban đầu (tùy chọn)
        const itemMap = allItems.reduce((map, item) => {
            map[item._id.toString()] = item;
            return map;
        }, {});

        // Sắp xếp lại kết quả theo thứ tự ID gửi lên
        const sortedItems = ids.map(id => itemMap[id]).filter(item => item); // filter(item => item) để loại bỏ ID không tìm thấy

        res.json(sortedItems);

    } catch (error) {
        console.error("Lỗi khi lấy chi tiết giỏ hàng:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// API MỚI CHO LIVE SEARCH
router.get('/live-search', async (req, res) => {
    try {
        const queryTerm = req.query.q;
        if (!queryTerm || queryTerm.length < 2) {
            return res.json([]); // Trả về mảng rỗng nếu query quá ngắn
        }

        const escapedQuery = escapeRegex(queryTerm);
        const searchQuery = { name: { $regex: escapedQuery, $options: 'i' } };

        // Tìm kiếm song song (chỉ lấy tên, ảnh và model)
        const productsPromise = Product.find(searchQuery).select('name imageUrl').limit(3);
        const accessoriesPromise = Accessory.find(searchQuery).select('name imageUrl').limit(3);
        const giftSetsPromise = GiftSet.find(searchQuery).select('name imageUrl').limit(3);

        const [products, accessories, giftSets] = await Promise.all([
            productsPromise,
            accessoriesPromise,
            giftSetsPromise
        ]);

        // Gộp kết quả và gửi về (giới hạn tổng 6 kết quả)
        const results = [...products, ...accessories, ...giftSets].slice(0, 6);

        // Thêm itemType vào kết quả để tạo link
        const finalResults = results.map(item => ({
            _id: item._id,
            name: item.name,
            imageUrl: item.imageUrl,
            itemModel: item.constructor.modelName.toLowerCase() // 'product', 'accessory', 'giftset'
        }));

        res.json(finalResults);

    } catch (error) {
        console.error("Lỗi live search:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});
// THÊM API MỚI ĐỂ NHẬN ĐÁNH GIÁ
router.post('/review/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { name, email, rating, comment } = req.body;
        let userId = req.session.userId; // Lấy ID người dùng nếu đã đăng nhập

        // 1. Kiểm tra đầu vào
        if (!rating || !comment || !name) {
            // Đây là lỗi, nhưng chúng ta sẽ xử lý ở client
            return res.status(400).send('Thiếu thông tin.');
        }

        // 2. Nếu người dùng chưa đăng nhập, tìm hoặc tạo 1 user "ảo"
        // (Trong thực tế, bạn nên BẮT BUỘC họ đăng nhập)
        if (!userId) {
            // Chỉ cho phép đánh giá nếu đã đăng nhập
             return res.status(401).send('Bạn cần đăng nhập để đánh giá.');
        }

        const Model = getModelByType(type);
        if (!Model) return res.status(404).send('Không tìm thấy loại sản phẩm');

        const item = await Model.findById(id);
        if (!item) return res.status(404).send('Không tìm thấy sản phẩm');

        // 3. (Nâng cao) Kiểm tra xem người dùng này đã mua hàng chưa
        // (Bỏ qua bước này để test cho dễ)

        /*
        // 4. (Nâng cao) Kiểm tra xem người dùng này đã đánh giá sản phẩm này chưa
        const alreadyReviewed = item.reviews.find(
            r => r.user.toString() === userId.toString()
        );
        if (alreadyReviewed) {
             return res.status(400).send('Bạn đã đánh giá sản phẩm này rồi.');
        }
        */
       
        // 5. Tạo đánh giá mới
        const review = {
            user: userId,
            name: name, // Nên lấy tên từ currentUser cho an toàn
            rating: Number(rating),
            comment: comment
        };
        
        item.reviews.push(review);
        await item.save();

        // Quay lại trang chi tiết sản phẩm
        res.redirect(`/items/detail/${type}/${id}`);

    } catch (error) {
        console.error("Lỗi khi gửi đánh giá:", error);
        res.status(500).send('Lỗi server');
    }
});
module.exports = router;