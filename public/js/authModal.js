// public/js/authModal.js
document.addEventListener('DOMContentLoaded', () => {
    // Lấy các phần tử cần thiết
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeAuthModalButton = document.querySelector('.close-auth-modal');
    // Lấy link Đăng nhập/Đăng ký từ header (cần id hoặc class cụ thể)
    const loginLink = document.getElementById('login-link'); // <-- Cần thêm ID này vào header
    const registerLink = document.getElementById('register-link'); // <-- Cần thêm ID này vào header

    // Hàm mở modal
    function openModal() {
        if (authModalOverlay) {
            authModalOverlay.classList.add('visible');
        }
    }

    // Hàm đóng modal
    function closeModal() {
        if (authModalOverlay) {
            authModalOverlay.classList.remove('visible'); // Ẩn modal trước

            // KIỂM TRA: Nếu đang ở trang login hoặc register thì chuyển về trang chủ
            if (window.location.pathname === '/login' || window.location.pathname === '/register') {
                window.location.href = '/'; // Chuyển hướng về trang chủ
            }
            // Nếu không phải trang login/register (trường hợp này ít xảy ra với logic hiện tại)
            // thì không cần chuyển hướng, chỉ cần ẩn modal là đủ.
        }
    }
    // Gắn sự kiện click cho link Đăng nhập
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            // Nếu đang ở trang đăng ký thì chuyển hướng, nếu không thì mở modal
            if (window.location.pathname !== '/login') {
                e.preventDefault(); // Ngăn chuyển trang nếu không phải trang login
                // Có thể cần tải lại trang login vào modal nếu cấu trúc phức tạp
                 window.location.href = '/login'; // Tạm thời chuyển trang
                // openModal(); // Hoặc mở modal nếu nội dung đã đúng
            }
        });
    }

    // Gắn sự kiện click cho link Đăng ký
     if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            if (window.location.pathname !== '/register') {
                 e.preventDefault();
                 window.location.href = '/register'; // Tạm thời chuyển trang
                 // openModal(); 
            }
        });
    }

    // Gắn sự kiện click cho nút đóng (X)
    if (closeAuthModalButton) {
        closeAuthModalButton.addEventListener('click', closeModal);
    }

    // Gắn sự kiện click vào lớp phủ (để đóng khi click ra ngoài)
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', (event) => {
            // Chỉ đóng nếu click trực tiếp vào lớp phủ, không phải vào content
            if (event.target === authModalOverlay) {
                closeModal();
            }
        });
    }
    
    // Tự động mở modal nếu đang ở trang /login hoặc /register
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
         openModal();
    }

});