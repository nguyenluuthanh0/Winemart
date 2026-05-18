// Load biến môi trường từ file .env
require('dotenv').config();

async function checkMyModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Đang kiểm tra quyền hạn của API Key...");

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.log("Lỗi từ Google:", data.error.message);
            return;
        }

        console.log("=== DANH SÁCH MÔ HÌNH BẠN ĐƯỢC DÙNG ===");
        data.models.forEach(model => {
            // Chỉ lọc những model hỗ trợ chat (generateContent)
            if(model.supportedGenerationMethods.includes("generateContent")) {
                // In ra tên model chính xác (đã cắt bỏ chữ 'models/' ở đầu)
                console.log(`- ${model.name.replace('models/', '')}`);
            }
        });
        console.log("=====================================");
    } catch (error) {
        console.error("Lỗi kết nối mạng:", error);
    }
}

checkMyModels();