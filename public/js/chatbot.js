document.addEventListener("DOMContentLoaded", () => {
    // Lấy các phần tử HTML
    const toggleBtn = document.getElementById("chatbot-toggle");
    const closeBtn = document.getElementById("chatbot-close");
    const chatContainer = document.getElementById("chatbot-container");
    const sendBtn = document.getElementById("chat-send");
    const chatInput = document.getElementById("chat-input");
    const messagesDiv = document.getElementById("chat-messages");

    // 1. Mở khung chat khi bấm nút "Tư vấn AI"
    toggleBtn.addEventListener("click", () => {
        chatContainer.style.display = "flex";
        toggleBtn.style.display = "none"; // Ẩn nút tròn đi
    });

    // 2. Đóng khung chat khi bấm dấu X
    closeBtn.addEventListener("click", () => {
        chatContainer.style.display = "none";
        toggleBtn.style.display = "block"; // Hiện lại nút tròn
    });

    // Hàm phụ trợ: Vẽ tin nhắn lên màn hình
    function appendMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.style.padding = "10px 15px";
        // Nếu là user thì bo tròn góc trái, bot thì bo tròn góc phải
        msgDiv.style.borderRadius = sender === "user" ? "15px 15px 0 15px" : "15px 15px 15px 0";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.fontSize = "14px";
        msgDiv.style.lineHeight = "1.4";
        
        if (sender === "user") {
            msgDiv.style.backgroundColor = "#800020"; // Màu đỏ mận của Winemart
            msgDiv.style.color = "white";
            msgDiv.style.alignSelf = "flex-end";
        } else {
            msgDiv.style.backgroundColor = "#e9ecef"; // Màu xám nhạt
            msgDiv.style.color = "#333";
            msgDiv.style.alignSelf = "flex-start";
        }
        
        // Gemini có thể trả về các thẻ HTML như <b>, <i>, <br> nên dùng innerHTML
        msgDiv.innerHTML = text; 
        messagesDiv.appendChild(msgDiv);
        
        // Tự động cuộn thanh scroll xuống tin nhắn mới nhất
        messagesDiv.scrollTop = messagesDiv.scrollHeight; 
    }

    // 3. Hàm xử lý gửi tin nhắn lên Server
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return; // Nếu tin nhắn rỗng thì không làm gì cả

        // In tin nhắn của khách hàng lên màn hình
        appendMessage("user", message);
        chatInput.value = ""; // Xóa trắng ô nhập

        // Hiển thị trạng thái "Đang suy nghĩ..."
        const loadingId = "loading-" + Date.now();
        appendMessage("bot", `<span id="${loadingId}"><em>Sommelier đang suy nghĩ...</em></span>`);

        try {
            // Gọi API POST /api/chat đến Backend Node.js
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            
            // Xóa dòng "Đang suy nghĩ..."
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.parentNode.remove();
            
            // In câu trả lời của AI lên màn hình
            appendMessage("bot", data.reply);

        } catch (error) {
            console.error("Lỗi:", error);
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) loadingElement.parentNode.remove();
            appendMessage("bot", "Xin lỗi, đã có lỗi kết nối xảy ra. Vui lòng thử lại!");
        }
    }

    // Gắn sự kiện khi bấm nút "Gửi"
    sendBtn.addEventListener("click", sendMessage);

    // Gắn sự kiện khi nhấn phím Enter trong ô input
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
});