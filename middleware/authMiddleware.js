// Middleware kiểm tra quyền Quản trị viên (Admin)
const isAdmin = (req, res, next) => {
    const user = res.locals.currentUser;

    // 1. Nếu chưa đăng nhập -> Đẩy về trang đăng nhập
    if (!user) {
        req.session.errorMessage = "Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập.";
        return res.redirect('/login');
    }

    // 2. Nếu đã đăng nhập và là Admin -> Cho phép đi tiếp
    if (user.role === 'admin') {
        return next();
    } 
    
    // 3. Nếu đã đăng nhập nhưng chỉ là User thường -> Chặn lại và báo lỗi 403
    return res.status(403).send(`
        <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
            <h1 style="color: #dc3545; font-size: 50px; margin-bottom: 10px;">403</h1>
            <h2>CẤM TRUY CẬP</h2>
            <p style="color: #666; margin-bottom: 20px;">Tài khoản của bạn không có quyền Quản trị viên để xem trang này.</p>
            <a href="/" style="padding: 10px 20px; background-color: #800020; color: white; text-decoration: none; border-radius: 5px;">
                Quay lại trang chủ
            </a>
        </div>
    `);
};

// Middleware kiểm tra yêu cầu Đăng nhập (Dành cho chức năng Giỏ hàng, Đơn hàng...)
const requireLogin = (req, res, next) => {
    if (res.locals.currentUser) {
        // Đã đăng nhập -> Cho đi tiếp
        return next();
    } else {
        // Chưa đăng nhập -> Đẩy về trang login kèm thông báo
        req.session.errorMessage = "Vui lòng đăng nhập để tiếp tục.";
        return res.redirect('/login');
    }
};

module.exports = { isAdmin, requireLogin };