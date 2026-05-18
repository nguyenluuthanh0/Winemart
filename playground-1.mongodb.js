use('Wineshop');

// 1. Set stock (số lượng) cho tất cả các bảng
db.products.updateMany({}, { $set: { stock: 100 } });
db.accessories.updateMany({}, { $set: { stock: 50 } });
db.giftsets.updateMany({}, { $set: { stock: 30 } });

// 2. Cập nhật trạng thái inStock cho BẢNG PRODUCTS
db.products.updateMany({ stock: { $gt: 0 } }, { $set: { inStock: true } });
db.products.updateMany({ stock: { $lte: 0 } }, { $set: { inStock: false } });

// 3. Cập nhật trạng thái inStock cho BẢNG ACCESSORIES
db.accessories.updateMany({ stock: { $gt: 0 } }, { $set: { inStock: true } });
db.accessories.updateMany({ stock: { $lte: 0 } }, { $set: { inStock: false } });

// 4. Cập nhật trạng thái inStock cho BẢNG GIFTSETS
db.giftsets.updateMany({ stock: { $gt: 0 } }, { $set: { inStock: true } });
db.giftsets.updateMany({ stock: { $lte: 0 } }, { $set: { inStock: false } });

// 5. In ra kết quả kiểm tra (Hiển thị cả stock và inStock để xem đã chuẩn chưa)
db.products.find({}, { name: 1, stock: 1, inStock: 1 }).limit(5);
db.accessories.find({}, { name: 1, stock: 1, inStock: 1 }).limit(5);
db.giftsets.find({}, { name: 1, stock: 1, inStock: 1 }).limit(5);