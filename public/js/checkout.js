// public/js/checkout.js
document.addEventListener('DOMContentLoaded', () => {
    buildOrderSummary();

    const checkoutForm = document.querySelector('.checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Ngăn submit form ngay lập tức

            const submitBtn = checkoutForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Đang xử lý...";
            }

            try {
                // Kiểm tra tồn kho trước
                const response = await fetch('/order/check-stock');
                const data = await response.json();

                if (!response.ok) {
                    // Hiển thị toast lỗi
                    if (typeof showToast === 'function') {
                        showToast(data.message.replace(/\n/g, '<br>'), 'error');
                    } else {
                        alert(data.message);
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "Đặt hàng";
                    }
                    return; // Dừng lại, không submit form
                }

                // Nếu ok, tiếp tục submit form
                checkoutForm.submit();

            } catch (error) {
                console.error('Lỗi kiểm tra tồn kho:', error);
                if (typeof showToast === 'function') {
                    showToast('Có lỗi xảy ra khi kiểm tra đơn hàng.', 'error');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Đặt hàng";
                }
            }
        });
    }
});

// Hàm này sẽ gọi API /cart/items để lấy giỏ hàng và xây dựng giao diện
async function buildOrderSummary() {
    const summaryContainer = document.getElementById('order-summary-items');
    const summaryTotalEl = document.getElementById('summary-total');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = '<p>Đang tải đơn hàng...</p>';

    try {
        const response = await fetch('/cart/items'); // Dùng API giỏ hàng đã có
        if (!response.ok) {
            throw new Error('Không thể tải giỏ hàng');
        }

        const data = await response.json();
        const { items, totalAmount } = data;

        if (!items || items.length === 0) {
            summaryContainer.innerHTML = '<p>Giỏ hàng của bạn đang trống.</p>';
            document.querySelector('.btn-auth').disabled = true; // Vô hiệu hóa nút đặt hàng
            return;
        }

        summaryContainer.innerHTML = ''; // Xóa chữ "Đang tải..."
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'summary-item';
            itemElement.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.name}" class="summary-item-img">
                <div class="summary-item-info">
                    <span class="summary-item-name">${item.name} (x${item.quantity})</span>
                </div>
                <span class="summary-item-price">${new Intl.NumberFormat('vi-VN').format(item.subtotal)} ₫</span>
            `;
            summaryContainer.appendChild(itemElement);
        });
        
        // Cập nhật tổng tiền
        summaryTotalEl.innerText = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount);

    } catch (error) {
        console.error('Lỗi khi xây dựng tóm tắt đơn hàng:', error);
        summaryContainer.innerHTML = '<p>Lỗi khi tải tóm tắt đơn hàng.</p>';
    }
}