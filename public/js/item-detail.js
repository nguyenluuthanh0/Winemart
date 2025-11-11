
document.addEventListener('DOMContentLoaded', () => {

    // --- Lấy các phần tử ---
    const openModalBtn = document.getElementById('btn-open-review-modal');
    const closeModalBtn = document.getElementById('btn-close-review-modal');
    const reviewModal = document.getElementById('review-modal-overlay');
    const reviewForm = document.getElementById('review-form');
    const reviewFormError = document.getElementById('review-form-error');

    // Sao bên trong MODAL
    const starInputContainer = document.getElementById('star-rating-input');
    const ratingValueInput = document.getElementById('rating-value');
    
    // Sao tĩnh bên NGOÀI (dưới điểm 5/5)
    const userPromptRatingStars = document.getElementById('user-prompt-rating-stars');

    
    /**
     * HÀM TÁI SỬ DỤNG:
     * Dùng để tô màu các ngôi sao BÊN TRONG MODAL
     * @param {string | number} value - Số sao (từ 1 đến 5)
     */
    const setRatingInModal = (value) => {
        if (!starInputContainer) return; // Thoát nếu không tìm thấy
        
        const starsInModal = starInputContainer.querySelectorAll('i');
        starsInModal.forEach(star => {
            if (star.dataset.value <= value) {
                star.classList.add('filled', 'fas');
                star.classList.remove('far');
            } else {
                star.classList.remove('filled', 'fas');
                star.classList.add('far');
            }
        });
    };


    // --- Logic 1: Mở/Đóng Modal (Giữ nguyên) ---
    if (openModalBtn && reviewModal) {
        openModalBtn.addEventListener('click', () => {
            reviewModal.classList.add('visible');
        });
    }
    if (closeModalBtn && reviewModal) {
        closeModalBtn.addEventListener('click', () => {
            reviewModal.classList.remove('visible');
            reviewFormError.style.display = 'none'; // Ẩn lỗi cũ khi đóng
            ratingValueInput.value = 0; // Reset sao
            setRatingInModal(0); // Tắt màu sao
        });
    }

    // --- Logic 2: Xử lý Sao BÊN TRONG Modal (Đã cập nhật) ---
    if (starInputContainer && ratingValueInput) {
        const stars = starInputContainer.querySelectorAll('i');

        // Khi di chuột qua
        starInputContainer.addEventListener('mouseover', (e) => {
            if (e.target.tagName === 'I') {
                const hoverValue = e.target.dataset.value;
                stars.forEach(star => {
                    if (star.dataset.value <= hoverValue) {
                        star.classList.add('hovered', 'fas');
                        star.classList.remove('far');
                    } else {
                        star.classList.remove('hovered', 'fas');
                        star.classList.add('far');
                    }
                });
            }
        });

        // Khi di chuột ra
        starInputContainer.addEventListener('mouseout', () => {
            stars.forEach(star => star.classList.remove('hovered'));
            setRatingInModal(ratingValueInput.value); // Quay về giá trị đã chọn
        });

        // Khi click chọn
        starInputContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'I') {
                const clickedValue = e.target.dataset.value;
                ratingValueInput.value = clickedValue; // Lưu giá trị
                setRatingInModal(clickedValue); // Tô màu cố định
            }
        });
    }
    
    // --- Logic 3: Xử lý Form Submit (Giữ nguyên) ---
    if (reviewForm) {
        reviewForm.addEventListener('submit', (e) => {
            // ... (code kiểm tra lỗi form của bạn giữ nguyên) ...
            
            // 2. Kiểm tra đã chọn sao chưa
            if (ratingValueInput.value === '0') {
                e.preventDefault(); 
                reviewFormError.innerText = 'Vui lòng chọn điểm đánh giá (số sao).';
                reviewFormError.style.display = 'block';
                return;
            }
        });
    }

    // ==========================================
    //     THÊM LOGIC MỚI CHO SAO TĨNH
    // ==========================================
    if (userPromptRatingStars && reviewModal) {
        userPromptRatingStars.addEventListener('click', (e) => {
            if (e.target.tagName === 'I') {
                const clickedValue = e.target.dataset.value;
                
                // 1. Mở modal
                reviewModal.classList.add('visible');
                
                // 2. Cập nhật giá trị input ẩn
                if (ratingValueInput) {
                    ratingValueInput.value = clickedValue;
                }
                
                // 3. Tô màu các ngôi sao BÊN TRONG modal
                setRatingInModal(clickedValue);
            }
        });
    }

});