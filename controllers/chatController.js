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
            .select('name price description region grape type stock') // Chọn các trường chứa thông tin quan trọng
            .limit(100); // Lấy tối đa 100 sản phẩm 

        // Lắp ráp thông tin sản phẩm thành văn bản
        let contextData = "Cửa hàng hiện tại chưa có sản phẩm nào.";
        if (products.length > 0) {
            contextData = products.map(p => 
                `- Tên: ${p.name} | Giá: ${p.price} VNĐ | Số lượng tồn: ${p.stock || 0} chai | Vùng/Quốc gia: ${p.region || 'Không rõ'} | Phân loại: ${p.type || 'Không rõ'} | Đặc điểm: ${p.description ? p.description.substring(0, 100) + '...' : 'Không có'}`
            ).join('\n');
        }

        // Tạo Prompt
        const prompt = `
        Bạn là một chuyên gia thử nếm rượu vang (Sommelier) và nhân viên chăm sóc khách hàng làm việc tại cửa hàng Winemart.
        Nhiệm vụ của bạn là tư vấn rượu vang và giải đáp các thắc mắc về dịch vụ của cửa hàng cho khách hàng.
        Giọng văn: Lịch sự, chuyên nghiệp, ngắn gọn.

        THÔNG TIN CHUNG VỀ CỬA HÀNG (Sử dụng thông tin này để trả lời các câu hỏi về dịch vụ):
        - Tên cửa hàng: WineMart
        - Địa chỉ: 123 Đường Rượu Vang, Quận 1, TP.HCM
        - Hotline/Zalo: 0123.456.789
        - Thời gian làm việc: 8:00 - 22:00 mọi ngày.
        - Chính sách giao hàng: Miễn phí vận chuyển nội thành TP.HCM cho đơn hàng từ 5.000.000 VNĐ. Các tỉnh thành khác phí vận chuyển đồng giá 100.000 VNĐ. Thời gian nhận hàng dự kiến từ 2-4 ngày.
        - Hình thức thanh toán: Hỗ trợ thanh toán tiền mặt khi nhận hàng (COD) và thanh toán trực tuyến qua cổng VNPay.
        - Chính sách đổi trả: Đổi trả miễn phí trong vòng 7 ngày nếu sản phẩm bị nứt vỡ do quá trình vận chuyển hoặc có lỗi từ nhà sản xuất (yêu cầu có video quay lúc mở hàng).
        
        QUY TẮC BẮT BUỘC (Guardrails):
        1. BẠN PHẢI ĐỌC KỸ "Danh sách sản phẩm hiện có" và "Thông tin chung về cửa hàng" bên dưới. 
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