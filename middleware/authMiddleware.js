const isAdmin = (req, res, next) => {
    // Chúng ta đã có currentUser từ middleware trong server.js
    const user = res.locals.currentUser;

    if (user && user.role === 'admin') {
        // Nếu là admin, cho đi tiếp
        next();
    } else {
        // Nếu không phải, chuyển hướng về trang chủ
        res.redirect('/');
    }
};
const requireLogin = (req, res, next) => {
    // res.locals.currentUser được gán trong server.js
    if (res.locals.currentUser) {
        // Nếu đã đăng nhập, cho đi tiếp
        next();
    } else {
        // Nếu chưa đăng nhập, chuyển hướng về trang login
        req.session.errorMessage = "Bạn cần đăng nhập để xem trang này.";
        res.redirect('/login');
    }
};

module.exports = { isAdmin, requireLogin };