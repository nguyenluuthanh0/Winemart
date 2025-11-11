document.addEventListener('DOMContentLoaded', () => {

    // === KHỞI TẠO SWIPER SLIDER (Giữ nguyên) ===
    const heroSwiper = new Swiper('.heroSwiper', {
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    });

    // === XỬ LÝ CLICK NÚT TRONG SLIDER (Giữ nguyên) ===
    document.querySelectorAll('.scroll-link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault(); 
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
            const filterOrigin = this.dataset.filterOrigin;
            if (filterOrigin) {
                const originFilterSelect = document.getElementById('filter-origin');
                if (originFilterSelect) {
                    originFilterSelect.value = filterOrigin; 
                    updateProducts(1); 
                }
            }
        });
    });

    // === LOGIC LỌC VÀ HIỂN THỊ SẢN PHẨM (ĐÃ CẬP NHẬT) ===
    
    // Lấy các element mới
    const quickFilterForm = document.getElementById('quick-filter-form');
    const typeFilter = document.getElementById('filter-type');
    const originFilter = document.getElementById('filter-origin');
    const brandFilter = document.getElementById('filter-brand');
    const budgetFilter = document.getElementById('filter-budget');
    
    const productList = document.getElementById('product-list');
    const paginationContainer = document.getElementById('pagination-container');
    const spinner = document.getElementById('loading-spinner');

    // Chỉ thực thi nếu chúng ta ở trang chủ (có productList)
    if (!productList) return; 

    /**
     * Hàm fetch sản phẩm từ API (Giữ nguyên)
     */
    async function fetchProducts(params) {
        spinner.classList.add('visible');
        productList.innerHTML = ''; 

        try {
            const response = await fetch(`/products/api?${params.toString()}`);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            displayProducts(data.products);
            displayPagination(data.currentPage, data.totalPages);
        } catch (error) {
            console.error('Không thể lấy danh sách sản phẩm:', error);
            productList.innerHTML = '<p>Lỗi khi tải sản phẩm. Vui lòng thử lại sau.</p>';
        } finally {
            spinner.classList.remove('visible');
        }
    }

    /**
     * Hàm hiển thị sản phẩm ra HTML
     */
    function displayProducts(products) {
        if (products.length === 0) {
            productList.innerHTML = '<p>Không tìm thấy sản phẩm nào khớp với điều kiện.</p>';
            return;
        }
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price);
            
            productCard.innerHTML = `
                <a href="/items/detail/product/${product._id}" class="product-link">
                    <img src="${product.imageUrl}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p class="product-origin">${product.origin}</p>
                    <p class="product-price">${formattedPrice}</p>
                </a>
                <button class="btn-add-to-cart" data-product-id="${product._id}" data-item-type="Product">Thêm vào giỏ</button>
            `;
            productList.appendChild(productCard);
        });
    }

    /**
     * Hàm hiển thị các nút phân trang
     */
    function displayPagination(currentPage, totalPages) {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'page-link';
            pageButton.innerText = i;
            pageButton.dataset.page = i;

            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            
            paginationContainer.appendChild(pageButton);
        }
    }
    
    /**
     * Hàm xử lý chính: Lấy giá trị lọc và gọi API (Đã cập nhật)
     */
    function updateProducts(page = 1) {
        const params = new URLSearchParams();

        // Lấy giá trị từ các bộ lọc mới
        const typeValue = typeFilter.value;
        if (typeValue) params.append('type', typeValue);
        
        const originValue = originFilter.value;
        if (originValue) params.append('origin', originValue);

        const brandValue = brandFilter.value;
        if (brandValue) params.append('brand', brandValue);
        
        const budgetValue = budgetFilter.value;
        if (budgetValue) params.append('budget', budgetValue);
        
        // Luôn thêm trang
        params.append('page', page);
        
        fetchProducts(params);
    }

    // === LẮNG NGHE SỰ KIỆN (ĐÃ CẬP NHẬT) ===
    
    // Lắng nghe sự kiện SUBMIT của form
    quickFilterForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Ngăn trang tải lại
        updateProducts(1); // Luôn tìm từ trang 1
    });
    
    // Lắng nghe click vào nút phân trang (Giữ nguyên)
    paginationContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('page-link')) {
            const page = parseInt(event.target.dataset.page);
            updateProducts(page);
        }
    });
    
    // Lắng nghe click "Thêm vào giỏ" (Giữ nguyên)
    productList.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-add-to-cart')) {
            const button = event.target; // Lấy cái nút
            const itemId = button.dataset.productId; // Lấy ID
            const itemType = button.dataset.itemType; // <-- LẤY THÊM DÒNG NÀY

            if (itemId && itemType) { // Kiểm tra cả hai
                addToCart(itemId, itemType); // Gọi hàm addToCart(itemId, itemType)
            }
        }
    });

    // Lần tải trang đầu tiên, fetch trang 1 (không có bộ lọc)
    updateProducts(1);
});