// public/js/notifications.js

/**
 * Hiển thị một thông báo toast.
 * @param {string} message - Nội dung thông báo.
 * @param {string} type - Loại thông báo ('success', 'error', 'info'). Mặc định là 'success'.
 * @param {number} duration - Thời gian hiển thị (mili-giây). Mặc định là 3000ms (3 giây).
 */
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Tạo một thẻ div mới cho toast
    const toast = document.createElement('div');

    // Thêm các class CSS cần thiết
    toast.classList.add('toast', type);

    // Thêm icon đơn giản và nội dung
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `${icon} ${message}`;

    // Thêm toast vào container
    container.appendChild(toast);

    // Tự động xóa toast sau một khoảng thời gian
    setTimeout(() => {
        toast.remove();
    }, duration);
}