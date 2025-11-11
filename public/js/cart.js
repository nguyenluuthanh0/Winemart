
/**
 * Lấy số lượng giỏ hàng ban đầu từ server khi tải trang.
 */
async function fetchInitialCartCount() {
    try {
        const response = await fetch('/cart/count');
        if (!response.ok) {
            // Nếu không ok (ví dụ: 401 chưa đăng nhập), thì không làm gì cả
            updateCartCountDisplay(0);
            return;
        }
        const data = await response.json();
        updateCartCountDisplay(data.count);
    } catch (error) {
        // Lỗi fetch (có thể do server sập hoặc người dùng offline)
        console.error('Lỗi khi tải số lượng giỏ hàng ban đầu:', error);
        updateCartCountDisplay(0); // Mặc định về 0 nếu có lỗi
    }
}

/**
 * Cập nhật số lượng trên icon giỏ hàng VÀ text trên trang giỏ hàng.
 * @param {number} count - Tổng số item.
 */
function updateCartCountDisplay(count) {
    // Cập nhật icon trên header
    const cartCountElement = document.getElementById('header-cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
        // Bỏ style display none để số 0 vẫn hiển thị
        if (count > 0) {
            cartCountElement.classList.add('visible');
        } else {
            cartCountElement.classList.remove('visible');
        }
    }
    
    // Cập nhật text trên trang giỏ hàng (nếu có)
    const cartItemCountText = document.getElementById('cart-item-count-text');
    if (cartItemCountText) {
        cartItemCountText.textContent = `Bạn đang có ${count} sản phẩm trong giỏ hàng`;
    }
}

/**
 * Hàm chính để xây dựng và hiển thị trang giỏ hàng (Gọi API Backend).
 */
async function displayCartPage() {
    const container = document.getElementById('cart-items-container');
    const subtotalElement = document.getElementById('cart-subtotal');
    const totalFinalElement = document.getElementById('cart-total-final');
    const checkoutButton = document.getElementById('btn-proceed-checkout');

    // Kiểm tra các phần tử thiết yếu của trang giỏ hàng
    if (!container || !subtotalElement || !totalFinalElement) return;

    container.innerHTML = '<p style="text-align: center; margin-top: 2rem;">Đang tải giỏ hàng...</p>';
    if (checkoutButton) checkoutButton.style.display = 'none'; // Ẩn nút thanh toán khi đang tải

    try {
        const response = await fetch('/cart/items'); // Gọi API lấy chi tiết giỏ hàng
        
        if (!response.ok) {
            if (response.status === 401) { // Xử lý trường hợp chưa đăng nhập
                container.innerHTML = '<h2>Vui lòng <a href="/login" id="login-link-cart">đăng nhập</a> để xem giỏ hàng.</h2>';
                subtotalElement.textContent = '0 ₫';
                totalFinalElement.textContent = '0 ₫';
                updateCartCountDisplay(0); // Đảm bảo header cũng là 0
            } else { // Các lỗi server khác
                throw new Error('Lỗi server');
            }
            return; // Dừng hàm
        }

        const data = await response.json();
        const { items, totalAmount, count } = data;

        updateCartCountDisplay(count); // Cập nhật số lượng trên header và text

        if (items.length === 0) {
            container.innerHTML = '<p style="text-align: center; margin-top: 2rem;">Giỏ hàng của bạn đang trống.</p>';
            subtotalElement.textContent = '0 ₫';
            totalFinalElement.textContent = '0 ₫';
            if (checkoutButton) checkoutButton.style.display = 'none';
            return;
        }

        container.innerHTML = ''; // Xóa thông báo "Đang tải..."
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            // Đảm bảo item.itemModel tồn tại
            const itemModelString = item.itemModel ? item.itemModel.toLowerCase() : 'product'; 
            
            itemElement.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <a href="/items/detail/${itemModelString}/${item._id}" class="cart-item-name">${item.name}</a>
                    <span class="cart-item-price-each">${new Intl.NumberFormat('vi-VN').format(item.price)} ₫</span>
                </div>
                <div class="cart-item-quantity-controls">
                    <button class="cart-item-quantity-btn" data-id="${item._id}" data-type="${itemModelString}" data-action="decrease">-</button>
                    <input type="number" class="cart-item-quantity-input" value="${item.quantity}" min="1" readonly>
                    <button class="cart-item-quantity-btn" data-id="${item._id}" data-type="${itemModelString}" data-action="increase">+</button>
                </div>
                <span class="cart-item-subtotal">${new Intl.NumberFormat('vi-VN').format(item.subtotal)} ₫</span>
                <button class="cart-item-remove-btn" data-id="${item._id}" data-type="${itemModelString}"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(itemElement);
        });

        subtotalElement.textContent = new Intl.NumberFormat('vi-VN').format(totalAmount) + ' ₫';
        totalFinalElement.textContent = new Intl.NumberFormat('vi-VN').format(totalAmount) + ' ₫';
        if (checkoutButton) checkoutButton.style.display = 'block'; // Hiển thị nút thanh toán

    } catch (error) {
        console.error('Lỗi khi hiển thị giỏ hàng:', error);
        container.innerHTML = '<p style="text-align: center; margin-top: 2rem;">Lỗi khi tải giỏ hàng. Vui lòng thử lại.</p>';
        subtotalElement.textContent = '0 ₫';
        totalFinalElement.textContent = '0 ₫';
        if (checkoutButton) checkoutButton.style.display = 'none';
    }
}

/**
 * Gắn các sự kiện click/change cho các nút trong giỏ hàng.
 * Hàm này CHỈ được gọi bởi displayCartPage sau khi các nút được render.
 */
function attachCartEventListeners() {
    const cartContainer = document.getElementById('cart-items-container');
    if (!cartContainer) return;

    // Lắng nghe sự kiện CLICK cho nút Tăng/Giảm/Xóa
    cartContainer.addEventListener('click', (event) => {
        const target = event.target.closest('button'); // Tìm nút được click gần nhất
        if (!target) return; // Không phải click vào nút

        const itemId = target.dataset.id;
        const itemType = target.dataset.type;

        if (target.classList.contains('cart-item-quantity-btn')) {
            // Xử lý Tăng/Giảm
            const action = target.dataset.action;
            const inputElement = target.closest('.cart-item-quantity-controls').querySelector('input');
            let currentQuantity = parseInt(inputElement.value);
            let newQuantity = currentQuantity;

            if (action === 'increase') {
                newQuantity++;
            } else if (action === 'decrease') {
                newQuantity--; // Cho phép giảm xuống 0
            }
            
            if (newQuantity < 0) return; // Không làm gì nếu < 0

            // Gọi updateQuantity (sẽ tự xử lý logic xóa nếu = 0)
            updateQuantity(itemId, itemType, newQuantity);
        
        } else if (target.classList.contains('cart-item-remove-btn')) {
            // Xử lý Xóa
            if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng không?')) {
                removeFromCart(itemId, itemType);
            }
        }
    });
}


/**
 * Thêm sản phẩm vào giỏ hàng (Gọi API Backend).
 * (Hàm này được gọi từ bên ngoài, nên cần là global)
 * @param {string} itemId - ID của sản phẩm.
 * @param {string} itemType - Loại model ('Product', 'Accessory', 'GiftSet')
 * @param {number} quantity - Số lượng (mặc định là 1)
 */
window.addToCart = async (itemId, itemType, quantity = 1) => {
    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, itemType, quantity })
        });
        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'Đã thêm sản phẩm vào giỏ hàng!', 'success');
            updateCartCountDisplay(data.newCartCount);
            // Nếu đang ở trang giỏ hàng, vẽ lại
            if (document.getElementById('cart-items-container')) {
                displayCartPage();
            }
        } else {
            showToast(data.message || 'Lỗi khi thêm vào giỏ hàng.', 'error');
        }
    } catch (error) {
        console.error('Lỗi mạng khi thêm vào giỏ hàng:', error);
        showToast('Lỗi kết nối server.', 'error');
    }
};

/**
 * Xử lý thay đổi số lượng (Gọi API Backend).
 * @param {string} itemId - ID sản phẩm
 * @param {string} itemType - Loại model
 * @param {number} newQuantity - Số lượng mới
 */
async function updateQuantity(itemId, itemType, newQuantity) {
    if (newQuantity === 0) {
        // Nếu số lượng là 0, gọi hàm xóa
        removeFromCart(itemId, itemType);
        return;
    }
    
    // Nếu số lượng > 0, gọi API cập nhật
    try {
        const response = await fetch('/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, itemType, quantity: newQuantity })
        });
        const data = await response.json();

        if (response.ok) {
            showToast('Đã cập nhật số lượng!', 'success');
            displayCartPage(); // Tải lại toàn bộ giỏ hàng
        } else {
            showToast(data.message || 'Lỗi khi cập nhật số lượng.', 'error');
            displayCartPage(); // Tải lại để reset về giá trị cũ nếu lỗi
        }
    } catch (error) {
        console.error('Lỗi mạng khi cập nhật số lượng:', error);
        showToast('Lỗi kết nối server.', 'error');
        displayCartPage(); // Tải lại để reset
    }
}

/**
 * Xử lý xóa sản phẩm (Gọi API Backend).
 * @param {string} itemId - ID sản phẩm
 * @param {string} itemType - Loại model
 */
async function removeFromCart(itemId, itemType) {
    try {
        const response = await fetch('/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, itemType })
        });
        const data = await response.json();

        if (response.ok) {
            showToast('Đã xóa sản phẩm khỏi giỏ hàng!', 'success');
            displayCartPage(); // Tải lại toàn bộ giỏ hàng
        } else {
            showToast(data.message || 'Lỗi khi xóa sản phẩm.', 'error');
        }
    } catch (error) {
        console.error('Lỗi mạng khi xóa sản phẩm:', error);
        showToast('Lỗi kết nối server.', 'error');
    }
}


// ===================================================
//              LẮNG NGHE SỰ KIỆN 
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Luôn lấy số lượng ban đầu
    fetchInitialCartCount(); 
    
    // 2. Kiểm tra xem có phải trang giỏ hàng không
    const cartContainer = document.getElementById('cart-items-container');
    if (cartContainer) {
        displayCartPage(); // Chỉ gọi nếu đây là trang giỏ hàng
        
        // Gắn sự kiện click/change vào container (Sửa lại logic cũ)
        cartContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button'); // Tìm nút được click
            if (!button) return;

            const itemId = button.dataset.id;
            const itemType = button.dataset.type;

            if (button.classList.contains('cart-item-quantity-btn')) {
                // Xử lý Tăng/Giảm
                const action = button.dataset.action;
                const inputElement = button.closest('.cart-item-quantity-controls').querySelector('input');
                let newQuantity = parseInt(inputElement.value);

                if (action === 'increase') newQuantity++;
                else if (action === 'decrease') newQuantity--;
                
                if (newQuantity < 0) newQuantity = 0; // Đảm bảo không bị âm

                updateQuantity(itemId, itemType, newQuantity); // Gọi hàm cập nhật (sẽ xử lý logic xóa nếu = 0)

            } else if (button.classList.contains('cart-item-remove-btn')) {
                // Xử lý Xóa
                if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng không?')) {
                    removeFromCart(itemId, itemType);
                }
            }
        });
    }
    
    // 3. Xử lý form đăng ký nhận tin (Newsletter)
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Ngăn trang tải lại
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            
            if (emailInput.value && emailInput.value.includes('@')) {
                if (typeof showToast === 'function') {
                    showToast('Cảm ơn bạn đã đăng ký!', 'success');
                }
                emailInput.value = '';
            } else {
                if (typeof showToast === 'function') {
                    showToast('Vui lòng nhập email hợp lệ.', 'error');
                }
            }
        });
    }
});