use('Wineshop');

// Set stock cho tất cả sản phẩm rượu
db.products.updateMany({}, { $set: { stock: 100 } });

// Set stock cho phụ kiện
db.accessories.updateMany({}, { $set: { stock: 50 } });

// Set stock cho hộp quà / giỏ quà
db.giftsets.updateMany({}, { $set: { stock: 30 } });

// In ra kết quả kiểm tra
db.products.find({}, { name: 1, stock: 1 }).limit(5);
db.accessories.find({}, { name: 1, stock: 1 }).limit(5);
db.giftsets.find({}, { name: 1, stock: 1 }).limit(5);
