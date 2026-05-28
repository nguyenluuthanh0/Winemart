const { GoogleGenerativeAI } = require("@google/generative-ai");
const Product = require("../models/productModel"); 

// Khởi tạo Gemini với API Key lấy từ file .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.chatWithAI = async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ reply: "Vui lòng nhập câu hỏi." });
        }

        // Chỉ select những trường cần thiết để tiết kiệm token gửi cho AI
        const products = await Product.find({ inStock: true })
            .select('name price description region grape category') // Chọn các trường chứa thông tin quan trọng
            .limit(100); // Lấy tối đa 100 sản phẩm 

        // Lắp ráp thông tin sản phẩm thành văn bản
        let contextData = "Cửa hàng hiện tại chưa có sản phẩm nào.";
        if (products.length > 0) {
            contextData = products.map(p => 
                `- Tên: ${p.name} | Giá: ${p.price} VNĐ | Vùng/Quốc gia: ${p.region || 'Không rõ'} | Phân loại: ${p.category} | Đặc điểm: ${p.description ? p.description.substring(0, 100) + '...' : 'Không có'}`
            ).join('\n');
        }

        // Tạo Prompt
        const prompt = `
        Bạn là một chuyên gia thử nếm rượu vang (Sommelier) làm việc tại cửa hàng Winemart.
        Nhiệm vụ của bạn là tư vấn rượu vang cho khách hàng.
        Giọng văn: Lịch sự, chuyên nghiệp, ngắn gọn.
        
        QUY TẮC BẮT BUỘC (Guardrails):
        1. BẠN PHẢI ĐỌC KỸ "Danh sách sản phẩm hiện có" bên dưới. 
        2. Tự động so sánh giá tiền, xuất xứ (Pháp, Ý, Chile...) để tìm ra sản phẩm khớp với câu hỏi.
        3. CHỈ TƯ VẤN các sản phẩm CÓ TRONG DANH SÁCH NÀY. Tuyệt đối không bịa đặt sản phẩm không có.
        4. Nếu không có sản phẩm nào thỏa mãn, hãy nói rõ là không có và gợi ý các sản phẩm khác có mức giá gần nhất.
        5. Sử dụng thẻ HTML cơ bản (<b>, <i>, <br>) để in đậm tên sản phẩm và định dạng câu trả lời cho đẹp mắt.

        Danh sách sản phẩm hiện có tại Winemart (Ngữ cảnh):
        ${contextData}

        Câu hỏi của khách hàng: "${userMessage}"
        `;

        // Gọi Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); 
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.status(200).json({ reply: responseText });

    } catch (error) {
        console.error("Lỗi hệ thống Chatbot AI:", error);
        res.status(500).json({ reply: "Sommelier hiện đang phục vụ quá nhiều khách hàng cùng lúc. Bạn vui lòng đợi vài giây rồi thử hỏi lại nhé! 🍷" });
    }
};