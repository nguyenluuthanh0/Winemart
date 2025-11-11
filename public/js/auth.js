document.addEventListener('DOMContentLoaded', () => {
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            // Nếu đang là type 'password' thì chuyển thành 'text' và ngược lại
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Thay đổi icon mắt
            togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
});