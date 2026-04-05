document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    const forgotPasswordLink = document.querySelector('.forgot-password-link');

    // Настраиваем ссылку "Забыли пароль?" на переход к password.html
    if (forgotPasswordLink) {
        forgotPasswordLink.href = 'password.html';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Останавливаем перезагрузку страницы

            // Прячем старую ошибку перед новым запросом
            errorMessage.style.display = 'none';

            const loginValue = emailInput.value.trim();
            const passwordValue = passwordInput.value;

            // На самом деле, хоть в test.http и написано "username", 
            // исходный код бэкенда (LoginDto) ждет от нас поле "login"! 
            // Именно поэтому выдавалась ошибка 400 Bad Request.
            const payload = {
                login: loginValue,
                password: passwordValue
            };

            try {
                // Отправляем POST запрос на бэкенд (теперь порт 5000!)
                const response = await fetch('http://localhost:5000/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Парсим ответ (обычно возвращается { access_token: "..." })
                    const data = await response.json();

                    // Сохраняем токен в localStorage (если ваш сервер его отдает)
                    const token = data.access_token || data.token;
                    if (token) {
                        localStorage.setItem('adminToken', token);
                    }

                    // При успешном входе редиректим на index.html
                    window.location.href = 'index.html';
                } else {
                    // Если статус 400 (Bad Request), 401 (Unauthorized) или 404 (Not Found)
                    errorMessage.innerText = 'Неверный логин (email) или пароль.';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                // Ошибка сети (например, сервер не запущен)
                console.error('Ошибка авторизации:', error);
                errorMessage.innerText = 'Сервер недоступен. Проверьте подключение.';
                errorMessage.style.display = 'block';
            }
        });
    }
});
