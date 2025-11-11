// utils/mailService.js
const nodemailer = require('nodemailer');

// 1. Cấu hình transporter (người gửi)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// 2. Hàm gửi mail kích hoạt
const sendVerificationEmail = async (email, token) => {
    // Tạo đường link kích hoạt
    const verificationUrl = `http://localhost:5000/verify-email?token=${token}`;

    const mailOptions = {
        from: `"WineMart" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Chào mừng bạn! Vui lòng xác thực tài khoản',
        html: `
            <h2>Chào mừng bạn đến với WineMart!</h2>
            <p>Vui lòng nhấp vào đường link bên dưới để kích hoạt tài khoản của bạn:</p>
            <a href="${verificationUrl}" style="padding: 10px 15px; background-color: #c5a47e; color: white; text-decoration: none; border-radius: 5px;">
                Kích hoạt tài khoản
            </a>
            <p>Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email xác thực đã gửi tới: ${email}`);
    } catch (error) {
        console.error("Lỗi khi gửi email:", error);
    }
};
const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: `"WineMart" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Mã xác thực tài khoản WineMart',
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2>Mã xác thực của bạn</h2>
                <p>Vui lòng sử dụng mã OTP bên dưới để hoàn tất đăng ký:</p>
                <h3 style="background-color: #f0f0f0; padding: 10px 15px; border-radius: 5px; display: inline-block;">
                    ${otp}
                </h3>
                <p>Mã này sẽ hết hạn sau 10 phút.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email OTP đã gửi tới: ${email}`);
    } catch (error) {
        console.error("Lỗi khi gửi email OTP:", error);
    }
};

module.exports = { sendVerificationEmail, sendOTPEmail };