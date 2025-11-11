const express = require('express');
const router = express.Router();
const Accessory = require('../models/accessoryModel'); 
const GiftSet = require('../models/giftSetModel');

// BẢN ĐỒ DANH MỤC: Giúp xác định danh mục cha
const categoryMap = {
    // Danh mục Rượu Vang
    'Vang đỏ': { parent: 'Rượu Vang', link: '#' }, // Tạm thời vẫn để # vì chưa có trang tổng quát cho Rượu Vang
    'Vang trắng': { parent: 'Rượu Vang', link: '#' },
    'Vang hồng': { parent: 'Rượu Vang', link: '#' },
    'Vang sủi': { parent: 'Rượu Vang', link: '#' },
    'Vang ngọt': { parent: 'Rượu Vang', link: '#' },
    'Vang cường hóa': { parent: 'Rượu Vang', link: '#' },

    // Danh mục Phụ Kiện (SỬA Ở ĐÂY)
    'Ly uống rượu': { parent: 'Phụ kiện rượu', link: '/products/category-overview/phu-kien-ruou' },
    'Tủ rượu đẹp': { parent: 'Phụ kiện rượu', link: '/products/category-overview/phu-kien-ruou' },
    'Hộp đựng rượu': { parent: 'Phụ kiện rượu', link: '/products/category-overview/phu-kien-ruou' },
    'Đồ khui rượu': { parent: 'Phụ kiện rượu', link: '/products/category-overview/phu-kien-ruou' },
    'Decanter (Bình thở rượu)': { parent: 'Phụ kiện rượu', link: '/products/category-overview/phu-kien-ruou' },

    // Danh mục Quà Tặng (SỬA Ở ĐÂY)
    'Hộp quà rượu vang': { parent: 'Quà Tặng', link: '/products/category-overview/qua-tang' },
    'Quà tặng doanh nghiệp': { parent: 'Quà Tặng', link: '/products/category-overview/qua-tang' },
    'Giỏ quà Tết': { parent: 'Quà Tặng', link: '/products/category-overview/qua-tang' },
    'Phụ kiện quà tặng': { parent: 'Quà Tặng', link: '/products/category-overview/qua-tang' }
};
// HÀM HELPER ĐỂ "THOÁT" CÁC KÝ TỰ ĐẶC BIỆT TRONG REGEX
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Import Product Model
const Product = require('../models/productModel');

// GET /products/api -> Lấy sản phẩm VỚI BỘ LỌC TỔNG HỢP (ĐÃ SỬA LỖI)
router.get('/api', async (req, res) => {
    try {
        // === 1. XÂY DỰNG CÁC ĐIỀU KIỆN LỌC (3 BỘ LỌC) ===
        const { search, type, origin, brand, budget, sort } = req.query;
        
        const productFilter = {};
        const accessoryFilter = {};
        const giftsetFilter = {};

        // --- Bộ lọc chung (Áp dụng cho cả 3) ---
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            productFilter.name = searchRegex;
            accessoryFilter.name = searchRegex;
            giftsetFilter.name = searchRegex;
        }
        if (budget) {
            const [minPrice, maxPrice] = budget.split('-').map(p => parseInt(p));
            const priceQuery = {};
            if (!isNaN(minPrice)) priceQuery.$gte = minPrice;
            if (!isNaN(maxPrice)) priceQuery.$lte = maxPrice;
            if (Object.keys(priceQuery).length > 0) {
                productFilter.price = priceQuery;
                accessoryFilter.price = priceQuery;
                giftsetFilter.price = priceQuery;
            }
        }

        // --- Bộ lọc 'Thương hiệu' (Logic đặc biệt) ---
        if (brand) {
            const brandRegex = { $regex: escapeRegex(brand), $options: 'i' };
            productFilter.brand = brandRegex; // Tìm trong trường `brand` của Product
            accessoryFilter.name = brandRegex; // Tìm trong trường `name` của Accessory
            giftsetFilter.name = brandRegex; // Tìm trong trường `name` của GiftSet
        }

        // --- Bộ lọc 'Loại Vang' & 'Xuất xứ' (Chỉ cho Product) ---
        if (type) productFilter.type = type;
        if (origin) productFilter.origin = origin;

        
        // === 2. THỰC HIỆN TRUY VẤN VÀ GỘP KẾT QUẢ ===
        let allItems = [];
        let totalProducts = 0;
        const page = parseInt(req.query.page) || 1;
        const productsPerPage = 12;
        const skip = (page - 1) * productsPerPage;

        // Cài đặt sắp xếp
        const sortQuery = {};
        if (sort === 'asc') sortQuery.price = 1;
        else if (sort === 'desc') sortQuery.price = -1;
        else sortQuery.createdAt = -1; // Sắp xếp mặc định

        
        // KIỂM TRA: Nếu người dùng lọc theo 'Loại Vang' hoặc 'Xuất xứ',
        // chúng ta chỉ cần tìm trong collection 'Product'.
        if (type || origin) {
            
            totalProducts = await Product.countDocuments(productFilter);
            const products = await Product.find(productFilter)
                .sort(sortQuery)
                .skip(skip)
                .limit(productsPerPage);
            
            allItems = [...products];

        } else {
            // Ngược lại, nếu không lọc theo type/origin (mà lọc theo brand, budget, search)
            // chúng ta tìm trong CẢ 3 collections
            
            const productsPromise = Product.find(productFilter);
            const accessoriesPromise = Accessory.find(accessoryFilter);
            const giftsetsPromise = GiftSet.find(giftsetFilter);
            
            const [products, accessories, giftsets] = await Promise.all([
                productsPromise,
                accessoriesPromise,
                giftsetsPromise
            ]);
            
            const mergedResults = [...products, ...accessories, ...giftsets];
            
            // Sắp xếp kết quả đã gộp
            mergedResults.sort((a, b) => {
                if (sort === 'asc') return a.price - b.price;
                if (sort === 'desc') return b.price - a.price;
                // Chuyển đổi createdAt sang kiểu Date để so sánh chính xác nếu cần
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            
            totalProducts = mergedResults.length;
            
            // Phân trang trên mảng đã gộp
            allItems = mergedResults.slice(skip, skip + productsPerPage);
        }
        
        const totalPages = Math.ceil(totalProducts / productsPerPage);
        
        res.json({
            products: allItems, // Gửi về mảng đã gộp và phân trang
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).send('Server Error');
    }
});


// @route   GET /products/:id
// @desc    Hiển thị trang chi tiết cho một sản phẩm
// @access  Public
router.get('/:id', async (req, res) => { // <-- THÊM ROUTE MỚI NÀY
    try {
        // Lấy id từ URL
        const productId = req.params.id;
        
        // Tìm sản phẩm trong database bằng id
        const product = await Product.findById(productId);

        // Nếu không tìm thấy sản phẩm
        if (!product) {
            return res.status(404).send('Sản phẩm không tồn tại');
        }

        // Nếu tìm thấy, render trang product.ejs và truyền dữ liệu sản phẩm vào
        res.render('product', { product: product });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


router.get('/category/:categoryName', async (req, res) => {
    try {
        const categoryName = req.params.categoryName;
        const escapedCategoryName = escapeRegex(categoryName);

        let products = [];

        const wines = await Product.find({ type: { $regex: escapedCategoryName, $options: 'i' } });
        const accessories = await Accessory.find({ category: { $regex: escapedCategoryName, $options: 'i' } });
        const giftSets = await GiftSet.find({ category: { $regex: escapedCategoryName, $options: 'i' } });

        products = [...wines, ...accessories, ...giftSets];

        // === PHẦN TẠO BREADCRUMBS MỚI ===
        const breadcrumbs = [
            { name: "Trang Chủ", link: "/" }
        ];

        // Tìm danh mục cha từ bản đồ
        const parentInfo = categoryMap[categoryName];
        if (parentInfo) {
            breadcrumbs.push({ name: parentInfo.parent, link: parentInfo.link });
        }

        // Thêm trang hiện tại (không có link)
        breadcrumbs.push({ name: categoryName, link: "" });
        // ==================================

        res.render('category', { 
            products: products, 
            categoryName: categoryName,
            breadcrumbs: breadcrumbs // <-- Truyền breadcrumbs ra view
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});
// THÊM ROUTE MỚI CHO TRANG DANH MỤC CHA
router.get('/category-overview/:mainCategory', async (req, res) => {
    try {
        const mainCategory = req.params.mainCategory;
        let items = [];
        let categoryName = "";
        let breadcrumbs = [{ name: "Trang Chủ", link: "/" }];

        if (mainCategory === 'phu-kien-ruou') {
            categoryName = "Phụ kiện rượu";
            // Lấy TẤT CẢ sản phẩm từ collection Accessory
            items = await Accessory.find({});
            breadcrumbs.push({ name: categoryName, link: "" });
        } 
        else if (mainCategory === 'qua-tang') {
            categoryName = "Quà Tặng";
            // Lấy TẤT CẢ sản phẩm từ collection GiftSet
            items = await GiftSet.find({});
            breadcrumbs.push({ name: categoryName, link: "" });
        } 
        else {
            // Trường hợp không tìm thấy
            return res.status(404).send("Không tìm thấy danh mục");
        }

        res.render('category-overview', { 
            items: items, 
            categoryName: categoryName,
            breadcrumbs: breadcrumbs
        });

    } catch (error) {
        console.error("Lỗi trang tổng quát:", error);
        res.status(500).send("Server Error");
    }
});
module.exports = router;