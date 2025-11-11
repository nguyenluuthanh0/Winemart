// public/js/ageGate.js
document.addEventListener('DOMContentLoaded', () => {
    const ageGateOverlay = document.getElementById('age-gate-overlay');
    const closeButton = document.getElementById('age-gate-close');

    // Kiểm tra sessionStorage xem đã đồng ý chưa
    const hasAgreed = sessionStorage.getItem('ageGateAgreed');

    // Nếu chưa đồng ý và pop-up tồn tại thì hiển thị
    if (!hasAgreed && ageGateOverlay) {
        ageGateOverlay.classList.add('visible');
    }

    // Gắn sự kiện click cho nút Đồng ý
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            if (ageGateOverlay) {
                ageGateOverlay.classList.remove('visible'); // Ẩn pop-up
                sessionStorage.setItem('ageGateAgreed', 'true'); // Lưu trạng thái đã đồng ý
            }
        });
    }
});