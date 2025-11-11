// public/js/header.js
document.addEventListener('DOMContentLoaded', () => {

    // --- Xử lý Logic Dropdown Tài khoản ---
    const userIcon = document.getElementById('user-icon');
    const userDropdown = document.getElementById('user-dropdown');
    const loginLink = document.getElementById('login-link');
    const authModal = document.getElementById('auth-modal-overlay');

    if (userIcon && userDropdown) {
        // Bật/tắt dropdown khi đã đăng nhập
        userIcon.addEventListener('click', (e) => {
            e.preventDefault();
            userDropdown.classList.toggle('visible');
        });

        // Đóng dropdown khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (!userIcon.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('visible');
            }
        });
    }

    if (loginLink && authModal) {
        // Gắn sự kiện click cho icon đăng nhập (khi chưa login)
        // để mở modal đăng nhập (từ file authModal.js)
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.add('visible');
        });
    }

    // ==========================================
    //     LOGIC LIVE SEARCH MỚI
    // ==========================================
    const searchInput = document.getElementById('header-search-input');
    const resultsContainer = document.getElementById('live-search-results');
    let debounceTimer;

    if (searchInput && resultsContainer) {
        // Lắng nghe sự kiện "input" (mỗi khi gõ)
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer); // Xóa timer cũ
            const query = searchInput.value.trim();

            if (query.length < 2) {
                resultsContainer.style.display = 'none'; // Ẩn kết quả
                return;
            }

            // Đặt timer mới (chỉ tìm kiếm sau khi người dùng ngừng gõ 300ms)
            debounceTimer = setTimeout(() => {
                fetchSearchResults(query);
            }, 300);
        });

        // Ẩn kết quả khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    // Hàm gọi API
    async function fetchSearchResults(query) {
        try {
            const response = await fetch(`/items/live-search?q=${encodeURIComponent(query)}`);
            if (!response.ok) return;
            const results = await response.json();
            displaySearchResults(results);
        } catch (error) {
            console.error('Lỗi fetch search:', error);
        }
    }

    // Hàm hiển thị kết quả ra dropdown
    function displaySearchResults(results) {
        resultsContainer.innerHTML = ''; // Xóa kết quả cũ
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="result-item no-result">Không tìm thấy kết quả.</div>';
        } else {
            results.forEach(item => {
                const itemElement = document.createElement('a');
                itemElement.className = 'result-item';
                itemElement.href = `/items/detail/${item.itemModel}/${item._id}`;
                itemElement.innerHTML = `
                    <img src="${item.imageUrl}" alt="${item.name}" class="result-item-img">
                    <span class="result-item-name">${item.name}</span>
                `;
                resultsContainer.appendChild(itemElement);
            });
            // Thêm link "Xem tất cả"
             resultsContainer.innerHTML += `<a href="/search?q=${searchInput.value}" class="result-item all-results">Xem tất cả kết quả</a>`;
        }
        resultsContainer.style.display = 'block'; // Hiển thị dropdown
    }
});