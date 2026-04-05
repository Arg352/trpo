# TRPO: Система Микроменеджмента Склада

Данный проект состоит из бэкенда на **NestJS** (Prisma + SQL Server) и фронтенда на **Electron**.

## 🚀 Быстрый запуск

### 1. Предварительные требования
*   Установленный **Node.js** (v18+)
*   Запущенный экземпляр **SQL Server** (напр. SQL Express)

---

### 2. Запуск Бэкенда
Перейдите в папку бэкенда и установите зависимости:
```powershell
cd backend
npm install
```

**Настройка базы данных:**
1.  Создайте файл `.env` в папке `backend` (если его нет).
2.  Укажите строку подключения `DATABASE_URL`. Пример:
    `DATABASE_URL="sqlserver://localhost:1433;database=trpo;user=sa;password=YourPassword;trustServerCertificate=true"`

**Инициализация БД:**
```powershell
npx prisma db push
npx prisma generate
npm run seed
```

**Запуск:**
```powershell
npm run start:dev
```

---

### 3. Запуск Фронтенда (Приложение Electron)
Откройте **новое окно терминала** в корне проекта:
```powershell
cd frontend
npm install
npm start
```

---

## 🛠 Технологический стек
*   **Бэкенд:** NestJS, Prisma ORM, Passport (JWT)
*   **База данных:** Microsoft SQL Server
*   **Фронтенд:** Electron, Vanilla JS, CSS (Professional Glassmorphism Design)

## 📋 Основные возможности
*   Интерфейс для **Сборщика**: Пошаговая сборка заказа (1 активный + 1 в очереди), отображение отделов и ячеек.
*   Интерфейс для **Бригадира**: Назначение заказов сотрудникам, управление составом бригады.
*   Интерфейс для **Старшего менеджера**: Распределение заказов по бригадам, управление пользователями.
*   **Автоматизация**: Сброс данных до тестовых (3 заказа) при каждом запуске бэкенда в режиме разработки.
