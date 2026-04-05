document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('adminToken');

    // Если токена нет, отправляем на страницу логина
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Получаем данные текущего пользователя
        const response = await fetch('http://localhost:5000/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Токен недействителен или истек');
        }

        const user = await response.json();
        const roleName = user.role ? user.role.name : 'worker';

        renderUserProfile(user, roleName);
        renderSidebarMenu(roleName);

    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        const token = localStorage.getItem('adminToken');
        try {
            await fetch('http://localhost:5000/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { /* ignore */ }
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    });
});

function renderUserProfile(user, roleNameStr) {
    window.currentUser = user; // Сохраняем глобально
    const firstName = user.firstName || 'Пользователь';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    document.getElementById('user-name').textContent = fullName;

    // Первая буква имени для аватара
    document.getElementById('user-avatar').textContent = firstName.charAt(0).toUpperCase();

    // Новые роли микроменеджмента
    const roleNameMap = {
        'senior_manager': 'Старший менеджер',
        'foreman': 'Бригадир',
        'worker': 'Сотрудник'
    };
    const roleName = roleNameMap[roleNameStr] || 'Пользователь';

    document.getElementById('user-role-name').textContent = roleName;
}

// Конфигурация вкладок для микроменеджмента
const ALL_TABS = [
    { id: 'orders_manager', title: 'Все заказы', icon: 'fa-solid fa-list', subtitle: 'Распределение заказов по бригадам', roles: ['senior_manager'] },
    { id: 'employees', title: 'Сотрудники', icon: 'fa-solid fa-user-tie', subtitle: 'Управление персоналом и правами', roles: ['senior_manager'] },
    { id: 'orders_foreman', title: 'Заказы бригады', icon: 'fa-solid fa-clipboard-list', subtitle: 'Назначение заказов сотрудникам', roles: ['foreman'] },
    { id: 'team_members', title: 'Сотрудники бригады', icon: 'fa-solid fa-users', subtitle: 'Список сотрудников вашей бригады', roles: ['foreman'] },
    { id: 'picking', title: 'Сборка заказов', icon: 'fa-solid fa-box-open', subtitle: 'Сбор текущего заказа по ячейкам', roles: ['worker'] }
];

function renderSidebarMenu(userRoleName) {
    const menuContainer = document.getElementById('sidebar-menu');
    menuContainer.innerHTML = ''; // Очищаем

    // Фильтруем вкладки по роли
    const availableTabs = ALL_TABS.filter(tab => tab.roles.includes(userRoleName));

    if (availableTabs.length === 0) {
        updateHeader('', '');
        document.getElementById('content-area').innerHTML = '';
        return;
    }

    availableTabs.forEach((tab, index) => {
        const item = document.createElement('a');
        item.className = 'menu-item';

        // По дефолту делаем первую доступную вкладку активной
        if (index === 0) {
            item.classList.add('active');
            updateHeader(tab.title, tab.subtitle);
            renderTabContent(tab.id);
        }

        item.innerHTML = `<i class="${tab.icon}"></i> ${tab.title}`;

        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            updateHeader(tab.title, tab.subtitle);
            renderTabContent(tab.id);
        });

        menuContainer.appendChild(item);
    });
}

function updateHeader(title, subtitle, actionsHtml = '') {
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;
    const actionsContainer = document.getElementById('header-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = actionsHtml;
    }
}

// Функция для отрисовки содержимого конкретной вкладки (заглушки для новых экранов микроменеджмента)
function renderTabContent(tabId) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = ''; // Очищаем предыдущий контент

    // Стили для карточек
    const stubStyle = "padding: 40px; text-align: center; background: #fff; border-radius: 8px; border: 1px dashed #ccc; margin: 20px;";

    if (tabId === 'orders_manager') {
        renderManagerOrdersTab(contentArea);
        return;
    } else if (tabId === 'employees') {
        renderEmployeesTab(contentArea);
        return;
    } else if (tabId === 'orders_foreman') {
        renderForemanOrdersTab(contentArea);
        return;
    } else if (tabId === 'team_members') {
        renderTeamMembersTab(contentArea);
        return;
    } else if (tabId === 'picking') {
        renderPickingTab(contentArea);
    } else {
        contentArea.innerHTML = '<div style="' + stubStyle + '">Контент вкладки "' + tabId + '" еще не реализован.</div>';
    }
}

// Вспомогательные функции для статусов
const statusMap = {
    'new': { label: 'Новый', class: 'badge-processing' }, // Сделаем желтым по дефолту
    'processing': { label: 'В обработке', class: 'badge-processing' },
    'shipped': { label: 'Отправлен', class: 'badge-shipped' },
    'delivered': { label: 'Доставлен', class: 'badge-delivered' },
    'cancelled': { label: 'Отменен', class: 'badge-processing' } // Можно сделать красный бейдж потом
};

function getStatusInfo(status) {
    return statusMap[status] || { label: status, class: 'badge-processing' };
}

// Форматирование даты
function formatDate(dateStr) {
    if (!dateStr) return 'Неизвестно';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Рендер вкладки "Заказы" с фетчем из БД
async function renderOrdersTab(container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов...</div>`;

    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('http://localhost:5000/orders/admin/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки заказов');
        }

        const data = await response.json();
        // data может быть массивом заказов или объектом { items: [], total: ... }
        const orders = Array.isArray(data) ? data : (data.items || data.data || []);

        const ordersHTML = `
            <div class="orders-toolbar">
                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="Поиск по номеру заказа или клиенту...">
                </div>
                <div class="filter-box">
                    <i class="fa-solid fa-filter"></i>
                    <select class="filter-select">
                        <option>Все заказы</option>
                    </select>
                </div>
            </div>

            <div class="orders-list">
                ${orders.length > 0 ? orders.map(order => {
            const statusInfo = getStatusInfo(order.status);

            // Пытаемся вытащить имя клиента: из order.user, либо просто ID
            let clientName = 'Неизвестный клиент';
            if (order.user) {
                const fname = order.user.firstName || '';
                const lname = order.user.lastName || '';
                clientName = `${fname} ${lname}`.trim() || clientName;
            } else if (order.userId) {
                clientName = `ID пользователя: ${order.userId}`;
            }

            // Оплата (cash, card, sbp, null)
            let paymentType = 'Онлайн';
            if (order.paymentOnDelivery === 'cash') paymentType = 'Наличные';
            else if (order.paymentOnDelivery === 'card') paymentType = 'Карта курьеру';
            else if (order.paymentOnDelivery === 'sbp') paymentType = 'СБП';

            // Сумма
            const amount = Number(order.totalAmount || 0).toLocaleString('ru-RU');

            return `
                        <div class="order-card">
                            <div class="order-main-info">
                                <div class="order-header">
                                    <span class="order-number">#${order.id}</span>
                                    <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
                                </div>
                                <div class="order-client">Клиент: ${clientName}</div>
                                <div class="order-date">Дата: ${formatDate(order.createdAt)}</div>
                            </div>
                            <div class="order-amount-info">
                                <div class="order-sum">Сумма: ${amount} ₽</div>
                                <div class="order-payment">Оплата: ${paymentType}</div>
                            </div>
                            <div class="order-actions">
                                <div class="status-dropdown">
                                    <select class="status-select" data-order-id="${order.id}">
                                        <option value="new" ${order.status === 'new' ? 'selected' : ''}>Новый</option>
                                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>В обработке</option>
                                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
                                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Доставлен</option>
                                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменен</option>
                                    </select>
                                </div>
                                <button class="btn-icon"><i class="fa-regular fa-eye"></i></button>
                            </div>
                        </div>
                    `;
        }).join('') : '<div style="padding: 20px; text-align: center; color: #666;">Заказов пока нет</div>'}
            </div>
        `;

        container.innerHTML = ordersHTML;

        // Поиск по заказам
        const searchInput = container.querySelector('.search-box input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = container.querySelectorAll('.order-card');
                cards.forEach(card => {
                    const number = card.querySelector('.order-number')?.textContent.toLowerCase() || '';
                    const client = card.querySelector('.order-client')?.textContent.toLowerCase() || '';
                    if (number.includes(query) || client.includes(query)) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // Привязываем обработчики к выпадающим спискам для изменения статуса
        const selects = container.querySelectorAll('.status-select');
        selects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.getAttribute('data-order-id');
                const newStatus = e.target.value;
                const prevValue = e.target.getAttribute('data-prev-value') || [...e.target.options].find(o => o.defaultSelected)?.value;

                try {
                    const token = localStorage.getItem('adminToken');
                    const res = await fetch(`http://localhost:5000/orders/${orderId}/status`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: newStatus })
                    });

                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.message || 'Ошибка обновления статуса');
                    }

                    // Успешно обновилось, можно обновить интерфейс
                    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Обновление списка...</div>`;
                    renderOrdersTab(container); // перезагружаем вкладку для обновления бейджиков

                } catch (err) {
                    console.error(err);
                    alert(`Не удалось изменить статус: ${err.message}`);
                    e.target.value = prevValue; // Откат выбора
                }
            });
            // Сохраняем предыдущее значение при фокусе для отката
            select.addEventListener('focus', function () {
                this.setAttribute('data-prev-value', this.value);
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить таблицу заказов</div>`;
    }
}

// Рендер вкладки "Панель управления" (Дашборд)
async function renderDashboardTab(container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Загрузка данных...</div>`;

    // Специальный заголовок для дашборда
    const fname = window.currentUser?.firstName || 'Имя администратора';
    updateHeader(`Добро пожаловать, ${fname}!`, 'Обзор ключевых показателей магазина');

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('http://localhost:5000/admin/analytics/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки статистики');

        const data = await response.json();
        const { kpi, charts, lastOrders, lowStockProducts } = data;

        const formatMoney = (val) => Number(val).toLocaleString('ru-RU') + ' ₽';
        const getGrowthHTML = (percent, text) => {
            if (percent === null || percent === undefined) return `<span class="kpi-change neutral">Нет данных</span>`;
            if (percent > 0) return `<span class="kpi-change positive">+${percent}% ${text}</span>`;
            if (percent < 0) return `<span class="kpi-change negative">${percent}% ${text}</span>`;
            return `<span class="kpi-change neutral">0% ${text}</span>`;
        };

        const html = `
            <div class="dashboard-grid">
                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-header"><span>Продажи за неделю</span><i class="fa-solid fa-arrow-trend-up"></i></div>
                        <div class="kpi-value">${formatMoney(kpi.salesWeekly || 0)}</div>
                        ${getGrowthHTML(kpi.salesGrowthPercent, 'к прошлой неделе')}
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header"><span>Заказов</span><i class="fa-solid fa-cart-shopping"></i></div>
                        <div class="kpi-value">${kpi.ordersWeekly || 0}</div>
                        ${getGrowthHTML(kpi.ordersGrowthPercent, 'к прошлой неделе')}
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header"><span>Товаров на складе</span><i class="fa-solid fa-boxes-stacked"></i></div>
                        <div class="kpi-value">${kpi.totalStock || 0}</div>
                        <span class="kpi-change negative">${kpi.lowStockCount || 0} товара заканчиваются</span>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-header"><span>Активных клиентов</span><i class="fa-solid fa-user-group"></i></div>
                        <div class="kpi-value">${kpi.activeClients || 0}</div>
                        ${getGrowthHTML(kpi.clientsGrowthPercent, 'за месяц')}
                    </div>
                </div>

                <div class="charts-row">
                    <div class="dashboard-panel">
                        <h3>Продажи за неделю</h3>
                        <div class="chart-container"><canvas id="salesChart"></canvas></div>
                    </div>
                    <div class="dashboard-panel">
                        <h3>Количество заказов</h3>
                        <div class="chart-container"><canvas id="ordersChart"></canvas></div>
                    </div>
                </div>

                <div class="lists-row">
                    <div class="dashboard-panel scrollable-panel">
                        <h3>Последние заказы</h3>
                        <div class="scroll-wrapper">
                            ${(lastOrders || []).map(o => {
            const fname = (o.user && o.user.firstName) || '';
            const lname = (o.user && o.user.lastName) || '';
            const clientName = (fname + ' ' + lname).trim();
            const client = o.user ? clientName : 'ID: ' + o.userId;
            const statusInfo = getStatusInfo(o.status);
            const amount = formatMoney(Number(o.totalAmount || 0));
            return '<div class="dash-list-item">' +
                '<div class="dash-item-left">' +
                '<span class="dash-item-title">#' + o.id + '</span>' +
                '<span class="dash-item-sub">' + client + '</span>' +
                '</div>' +
                '<div class="dash-item-right">' +
                '<span class="dash-item-value">' + amount + '</span>' +
                '<span class="badge ' + statusInfo.class + '" style="zoom: 0.8">' + statusInfo.label + '</span>' +
                '</div>' +
                '</div>';
        }).join('')}
                        </div>
                    </div>
                    <div class="dashboard-panel scrollable-panel">
                        <h3>Низкие остатки на складе</h3>
                        <div class="scroll-wrapper">
                            ${(lowStockProducts || []).map(p => {
            const skuText = p.sku ? '(' + p.sku + ')' : '';
            return '<div class="low-stock-item">' +
                '<span class="low-stock-title">' + p.name + ' ' + skuText + '</span>' +
                '<span class="low-stock-badge">Осталось: ' + p.stockQuantity + ' шт.</span>' +
                '</div>';
        }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        initCharts(charts);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить данные панели управления</div>`;
    }
}

function initCharts(data) {
    if (!window.Chart || !data || data.length === 0) return;

    const labels = data.map(d => {
        const date = new Date(d.date);
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[date.getDay()];
    });

    const salesData = data.map(d => d.sales);
    const ordersData = data.map(d => d.ordersCount);

    const ctxSales = document.getElementById('salesChart')?.getContext('2d');
    if (ctxSales) {
        new Chart(ctxSales, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Продажи (₽)',
                    data: salesData,
                    borderColor: '#0b1e8e',
                    backgroundColor: 'rgba(11, 30, 142, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctxOrders = document.getElementById('ordersChart')?.getContext('2d');
    if (ctxOrders) {
        new Chart(ctxOrders, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Заказы',
                    data: ordersData,
                    backgroundColor: '#0ea5e9',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// Рендер вкладки "Склад"
async function renderWarehouseTab(container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Загрузка данных склада...</div>`;

    updateHeader('Управление складом', 'Отслеживание остатков и управление запасами', '<button class="btn-primary"><i class="fa-solid fa-plus"></i> Добавить товар</button>');

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('http://localhost:5000/admin/inventory', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки склада');

        const products = await response.json();

        const lowStock = products.filter(p => p.stockQuantity <= 10).sort((a, b) => a.stockQuantity - b.stockQuantity);

        let lowStockHtml = '';
        if (lowStock.length > 0) {
            lowStockHtml = `
            <div class="low-stock-alert">
                <div class="low-stock-alert-header">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    Низкие остатки (${lowStock.length})
                </div>
                <div class="low-stock-list">
                    ${lowStock.map(p => {
                const skuText = p.sku ? ' (' + p.sku + ')' : '';
                return '<div class="low-stock-item" style="display:flex; justify-content:space-between; padding:12px 16px; align-items:center;">' +
                    '<span style="font-size:14px; font-weight:500; color:#1a1a1a;">' + p.name + skuText + '</span>' +
                    '<span class="low-stock-badge">Осталось: ' + p.stockQuantity + ' шт.</span>' +
                    '</div>';
            }).join('')}
                </div>
            </div>
            `;
        }

        const formatMoney = (val) => Number(val).toLocaleString('ru-RU') + ' ₽';

        const tableHtml = `
        <div class="warehouse-content">
            ${lowStockHtml}
            
            <div class="orders-toolbar" style="margin-bottom:0;">
                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="Поиск по названию или артикулу...">
                </div>
            </div>
            
            <div class="inventory-table-container">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Артикул</th>
                            <th>Название</th>
                            <th>Категория</th>
                            <th>Остаток</th>
                            <th>Цена</th>
                            <th>Поставщик</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => {
            const badgeColor = p.stockQuantity < 10 ? '#fdba74' : '#bbf7d0';
            const badgeText = p.stockQuantity < 10 ? '#9a3412' : '#166534';
            return `
                            <tr>
                                <td>${p.sku || '-'}</td>
                                <td><b>${p.name}</b></td>
                                <td>${p.category?.name || 'Без категории'}</td>
                                <td><span style="background:${badgeColor}; color:${badgeText}; padding:4px 12px; border-radius:12px; font-size:12px; font-weight:600; white-space:nowrap;">${p.stockQuantity} шт.</span></td>
                                <td><b>${formatMoney(p.price || 0)}</b></td>
                                <td>${p.supplier || '-'}</td>
                                <td><button class="btn-outline"><i class="fa-solid fa-pen-to-square"></i> Изменить</button></td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;

        container.innerHTML = tableHtml;

        // Поиск по складу
        const searchInput = container.querySelector('.search-box input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const rows = container.querySelectorAll('.inventory-table tbody tr');
                rows.forEach(row => {
                    const sku = row.cells[0].textContent.toLowerCase();
                    const name = row.cells[1].textContent.toLowerCase();
                    if (sku.includes(query) || name.includes(query)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить данные склада</div>`;
    }
}

// ─── Вкладка "Сотрудники" для старшего менеджера ──────────────────────
async function renderEmployeesTab(container, searchQuery = '') {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка сотрудников...</div>';

    updateHeader('Управление сотрудниками', 'Добавление сотрудников и настройка прав доступа',
        '<button class="btn-primary" id="btn-add-employee"><i class="fa-solid fa-plus"></i> Добавить сотрудника</button>');

    const token = localStorage.getItem('adminToken');
    try {
        const url = searchQuery
            ? `http://localhost:5000/users/admin/employees?search=${encodeURIComponent(searchQuery)}`
            : 'http://localhost:5000/users/admin/employees';

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки сотрудников');

        const employees = await response.json();

        const roleNameMap = { 'foreman': 'Бригадир', 'worker': 'Сотрудник' };
        const roleBadgeClass = { 'foreman': 'badge-foreman', 'worker': 'badge-worker' };

        const html = `
            <div class="orders-toolbar">
                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="employee-search" placeholder="Поиск по логину, имени или телефону..." value="${searchQuery || ''}">
                </div>
            </div>
            <div class="employees-list">
                ${employees.length > 0 ? employees.map(emp => {
                    const fullName = ((emp.firstName || '') + ' ' + (emp.lastName || '')).trim() || emp.username;
                    const initial = (emp.firstName || emp.username || '?').charAt(0).toUpperCase();
                    const roleLabel = roleNameMap[emp.roleName] || emp.roleName;
                    const roleBadge = roleBadgeClass[emp.roleName] || 'badge-worker';
                    const statusLabel = emp.status === 'active' ? 'В сети' : 'Не в сети';
                    const statusBadge = emp.status === 'active' ? 'badge-active' : 'badge-inactive';

                    let teamHtml = '';
                    if (emp.teamName) {
                        teamHtml = `
                            <div class="employee-team-row">
                                <i class="fa-solid fa-users"></i>
                                <span class="employee-team-label">Бригада: ${emp.teamName}</span>
                                <button class="btn-unassign" data-unassign-id="${emp.id}" title="Убрать из бригады" style="margin-left:8px; color:#ef4444; font-size:12px; cursor:pointer; background:none; border:none;"><i class="fa-solid fa-xmark"></i></button>
                            </div>`;
                    } else {
                        teamHtml = `
                            <div class="employee-team-row">
                                <i class="fa-solid fa-users" style="color:#d1d5db"></i>
                                <span class="employee-team-label" style="color:#9ca3af">Без бригады</span>
                            </div>`;
                    }

                    return `
                    <div class="employee-card" data-id="${emp.id}">
                        <div class="employee-avatar">${initial}</div>
                        <div class="employee-info">
                            <div class="employee-name-row">
                                <span class="employee-name">${fullName}</span>
                                <span class="badge-role ${roleBadge}">${roleLabel}</span>
                                <span class="badge-role ${statusBadge}">${statusLabel}</span>
                            </div>
                            <div class="employee-detail">${emp.email || ''}</div>
                            <div class="employee-detail">${emp.phone || 'Телефон не указан'}</div>
                            ${teamHtml}
                        </div>
                        <div class="employee-actions">
                            <button class="btn-icon-sm btn-danger" data-delete-id="${emp.id}" title="Удалить">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">Сотрудников не найдено</div>'}
            </div>
        `;

        container.innerHTML = html;

        // ─── Поиск ───────────────────────────────
        const searchInput = container.querySelector('#employee-search');
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    renderEmployeesTab(container, e.target.value.trim());
                }, 400);
            });
            // Восстанавливаем курсор
            searchInput.focus();
            searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }

        // ─── Удаление ────────────────────────────
        container.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const empId = btn.getAttribute('data-delete-id');
                if (!confirm('Вы уверены, что хотите удалить сотрудника?')) return;
                try {
                    const res = await fetch(`http://localhost:5000/users/admin/employees/${empId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error();
                    renderEmployeesTab(container, searchInput?.value?.trim() || '');
                } catch {
                    alert('Ошибка удаления сотрудника');
                }
            });
        });

        // ─── Кнопка "Добавить сотрудника" ─────────
        const addBtn = document.getElementById('btn-add-employee');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                showAddEmployeeModal(container);
            });
        }

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить список сотрудников</div>';
    }
}

function showAddEmployeeModal(container) {
    // Удаляем старый модал если есть
    const old = document.querySelector('.modal-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3>Добавить сотрудника</h3>
            <div class="modal-field">
                <label>Имя</label>
                <input type="text" id="modal-firstName" placeholder="Иван">
            </div>
            <div class="modal-field">
                <label>Фамилия</label>
                <input type="text" id="modal-lastName" placeholder="Иванов">
            </div>
            <div class="modal-field">
                <label>Логин</label>
                <input type="text" id="modal-username" placeholder="ivanov">
            </div>
            <div class="modal-field">
                <label>Email</label>
                <input type="email" id="modal-email" placeholder="ivanov@tech.com">
            </div>
            <div class="modal-field">
                <label>Пароль</label>
                <input type="password" id="modal-password" placeholder="Минимум 6 символов">
            </div>
            <div class="modal-field">
                <label>Телефон</label>
                <input type="text" id="modal-phone" placeholder="+7 (999) 123-45-67">
            </div>
            <div class="modal-field">
                <label>Роль</label>
                <select id="modal-role">
                    <option value="worker">Сотрудник</option>
                    <option value="foreman">Бригадир</option>
                </select>
            </div>
            <div id="modal-error" style="color:#dc2626; font-size:13px; margin-bottom:8px; display:none;"></div>
            <div class="modal-actions">
                <button class="btn-secondary" id="modal-cancel">Отмена</button>
                <button class="btn-primary" id="modal-submit">Создать</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Закрыть по клику на оверлей
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());

    document.getElementById('modal-submit').addEventListener('click', async () => {
        const token = localStorage.getItem('adminToken');
        const errorEl = document.getElementById('modal-error');

        const firstName = document.getElementById('modal-firstName').value.trim();
        const lastName = document.getElementById('modal-lastName').value.trim();
        const username = document.getElementById('modal-username').value.trim();
        const email = document.getElementById('modal-email').value.trim();
        const password = document.getElementById('modal-password').value;
        const phone = document.getElementById('modal-phone').value.trim();
        const roleName = document.getElementById('modal-role').value;

        if (!firstName || !lastName || !username || !email || !password) {
            errorEl.textContent = 'Заполните все обязательные поля';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/users/admin/employees', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ firstName, lastName, username, email, password, phone, roleName })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Ошибка создания');
            }

            overlay.remove();
            renderEmployeesTab(container);
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    });
}

// ─── Вкладка "Все заказы" для старшего менеджера ───────────────
async function renderManagerOrdersTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов...</div>';

    updateHeader('Распределение заказов', 'Назначение заказов на бригады');

    const token = localStorage.getItem('adminToken');
    try {
        const [ordersRes, teamsRes] = await Promise.all([
            fetch('http://localhost:5000/orders/manager/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('http://localhost:5000/orders/manager/teams', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!ordersRes.ok) throw new Error('Ошибка загрузки заказов');
        if (!teamsRes.ok) throw new Error('Ошибка загрузки бригад');

        const orders = await ordersRes.json();
        const teams = await teamsRes.json();

        const html = `
            <div class="orders-toolbar">
                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="manager-order-search" placeholder="Поиск по номеру заказа или клиенту...">
                </div>
            </div>
            <div class="orders-list">
                ${orders.length > 0 ? orders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    let clientName = 'Неизвестный клиент';
                    if (order.user) {
                        clientName = ((order.user.firstName || '') + ' ' + (order.user.lastName || '')).trim() || clientName;
                    }
                    const amount = Number(order.totalAmount || 0).toLocaleString('ru-RU');
                    const itemsList = (order.items || []).map(i =>
                        '<li>' + (i.product?.name || 'Товар') + ' × ' + i.quantity + '</li>'
                    ).join('');
                    const assignedTeamName = order.assignedTeam ? order.assignedTeam.name : null;

                    const actionBtn = assignedTeamName
                        ? `<div class="order-team-assigned" style="display:flex; align-items:center;">
                             <i class="fa-solid fa-users"></i> ${assignedTeamName}
                             <button class="btn-unassign btn-manager-unassign" data-order-id="${order.id}">Снять бригаду</button>
                           </div>`
                        : `<button class="btn-primary btn-open-assign" data-order-id="${order.id}" style="padding:8px 16px; font-size:13px;"><i class="fa-solid fa-user-plus"></i> Назначить</button>`;

                    return `
                    <div class="order-card" data-order-id="${order.id}">
                        <div class="order-main-info">
                            <div class="order-header">
                                <span class="order-number">#${order.id}</span>
                                <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
                            </div>
                            <div class="order-client">Клиент: ${clientName}</div>
                            <div class="order-date">Дата: ${formatDate(order.createdAt)}</div>
                            <ul style="margin-top:6px; font-size:13px; color:#4b5563; padding-left:18px;">${itemsList}</ul>
                        </div>
                        <div class="order-amount-info">
                            <div class="order-sum">Сумма: ${amount} ₽</div>
                        </div>
                        <div class="order-actions">
                            ${actionBtn}
                        </div>
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">Нет заказов для распределения</div>'}
            </div>
        `;

        container.innerHTML = html;

        // Поиск
        const searchInput = container.querySelector('#manager-order-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                container.querySelectorAll('.order-card').forEach(card => {
                    const number = card.querySelector('.order-number')?.textContent.toLowerCase() || '';
                    const client = card.querySelector('.order-client')?.textContent.toLowerCase() || '';
                    card.style.display = (number.includes(query) || client.includes(query)) ? '' : 'none';
                });
            });
        }

        // Кнопка «Снять бригаду»
        container.querySelectorAll('.btn-manager-unassign').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Вы уверены, что хотите снять бригаду с этого заказа?')) return;
                const orderId = btn.getAttribute('data-order-id');
                try {
                    const res = await fetch(`http://localhost:5000/orders/${orderId}/unassign-team`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Ошибка при снятии бригады');
                    renderManagerOrdersTab(container);
                } catch (err) {
                    alert(err.message);
                }
            });
        });

        // Кнопка «Назначить» → модалка выбора бригады
        container.querySelectorAll('.btn-open-assign').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-order-id');
                showAssignModal({
                    title: 'Назначить бригаду на заказ #' + orderId,
                    label: 'Выберите бригаду',
                    options: teams.map(t => {
                        const fn = (t.foreman.firstName + ' ' + t.foreman.lastName).trim();
                        return { value: t.id, text: t.name + ' (бригадир: ' + fn + ', ' + t._count.workers + ' раб.)' };
                    }),
                    onSubmit: async (value) => {
                        const res = await fetch(`http://localhost:5000/orders/${orderId}/assign-team`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ teamId: Number(value) })
                        });
                        if (!res.ok) throw new Error('Ошибка');
                        renderManagerOrdersTab(container);
                    }
                });
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить заказы</div>';
    }
}

// ─── Вкладка "Заказы бригады" для бригадира ───────────────────
async function renderForemanOrdersTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов бригады...</div>';

    updateHeader('Заказы бригады', 'Распределение заказов по сотрудникам');

    const token = localStorage.getItem('adminToken');
    try {
        const [ordersRes, membersRes] = await Promise.all([
            fetch('http://localhost:5000/orders/foreman/team-orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('http://localhost:5000/orders/foreman/team-members', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!ordersRes.ok) throw new Error('Ошибка загрузки заказов');
        if (!membersRes.ok) throw new Error('Ошибка загрузки сотрудников');

        const orders = await ordersRes.json();
        const membersData = await membersRes.json();
        const workers = membersData.members || [];

        const html = `
            <div class="orders-toolbar">
                <div class="search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="foreman-order-search" placeholder="Поиск по номеру заказа или клиенту...">
                </div>
            </div>
            <div class="orders-list">
                ${orders.length > 0 ? orders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    let clientName = 'Неизвестный клиент';
                    if (order.user) {
                        clientName = ((order.user.firstName || '') + ' ' + (order.user.lastName || '')).trim() || clientName;
                    }
                    const amount = Number(order.totalAmount || 0).toLocaleString('ru-RU');
                    const itemsList = (order.items || []).map(i =>
                        '<li>' + (i.product?.name || 'Товар') + ' × ' + i.quantity + '</li>'
                    ).join('');
                    const assignedWorker = order.assignedWorker;

                    let actionBtn = '';
                    if (assignedWorker) {
                        const wName = (assignedWorker.firstName + ' ' + assignedWorker.lastName).trim();
                        actionBtn = `
                            <div class="order-team-assigned" style="display:flex; align-items:center;">
                                <i class="fa-solid fa-user"></i> ${wName}
                                <button class="btn-unassign btn-foreman-unassign" data-order-id="${order.id}">Снять сотрудника</button>
                            </div>`;
                    } else {
                        actionBtn = `<button class="btn-primary btn-open-assign-worker" data-order-id="${order.id}" style="padding:8px 16px; font-size:13px;"><i class="fa-solid fa-user-plus"></i> Назначить</button>`;
                    }

                    return `
                    <div class="order-card" data-order-id="${order.id}">
                        <div class="order-main-info">
                            <div class="order-header">
                                <span class="order-number">#${order.id}</span>
                                <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
                            </div>
                            <div class="order-client">Клиент: ${clientName}</div>
                            <div class="order-date">Дата: ${formatDate(order.createdAt)}</div>
                            <ul style="margin-top:6px; font-size:13px; color:#4b5563; padding-left:18px;">${itemsList}</ul>
                        </div>
                        <div class="order-amount-info">
                            <div class="order-sum">Сумма: ${amount} ₽</div>
                        </div>
                        <div class="order-actions">
                            ${actionBtn}
                        </div>
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">Нет заказов для распределения</div>'}
            </div>
        `;

        container.innerHTML = html;

        // Поиск
        const searchInput = container.querySelector('#foreman-order-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                container.querySelectorAll('.order-card').forEach(card => {
                    const number = card.querySelector('.order-number')?.textContent.toLowerCase() || '';
                    const client = card.querySelector('.order-client')?.textContent.toLowerCase() || '';
                    card.style.display = (number.includes(query) || client.includes(query)) ? '' : 'none';
                });
            });
        }

        // Кнопка «Снять сотрудника»
        container.querySelectorAll('.btn-foreman-unassign').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Вы уверены, что хотите снять сотрудника с этого заказа?')) return;
                const orderId = btn.getAttribute('data-order-id');
                try {
                    const res = await fetch(`http://localhost:5000/orders/${orderId}/unassign-worker`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Ошибка при снятии сотрудника');
                    renderForemanOrdersTab(container);
                } catch (err) {
                    alert(err.message);
                }
            });
        });

        // Кнопка «Назначить» → модалка выбора работника
        container.querySelectorAll('.btn-open-assign-worker').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-order-id');
                showAssignModal({
                    title: 'Назначить сотрудника на заказ #' + orderId,
                    label: 'Выберите сотрудника',
                    options: workers.map(w => {
                        const name = (w.firstName + ' ' + w.lastName).trim();
                        return { value: w.id, text: name + ' (заказов: ' + w.activeOrdersCount + ')' };
                    }),
                    onSubmit: async (value) => {
                        const res = await fetch(`http://localhost:5000/orders/${orderId}/assign-worker`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ workerId: Number(value) })
                        });
                        if (!res.ok) throw new Error('Ошибка');
                        renderForemanOrdersTab(container);
                    }
                });
            });
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить заказы бригады</div>';
    }
}

// ─── Вкладка "Сотрудники бригады" для бригадира ───────────────
async function renderTeamMembersTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка сотрудников...</div>';

    updateHeader('Сотрудники бригады', 'Состав и статус вашей бригады');

    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('http://localhost:5000/orders/foreman/team-members', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки');

        const data = await response.json();
        const teamName = data.teamName;
        const members = data.members || [];

        const html = `
            <div style="margin-bottom: 20px;">
                <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Бригада: ${teamName}</span>
                <span style="margin-left: 12px; font-size: 14px; color: #6b7280;">${members.length} сотрудников</span>
            </div>
            <div class="employees-list">
                ${members.length > 0 ? members.map(w => {
                    const fullName = (w.firstName + ' ' + w.lastName).trim() || w.username;
                    const initial = (w.firstName || w.username || '?').charAt(0).toUpperCase();
                    const statusLabel = w.status === 'active' ? 'В сети' : 'Не в сети';
                    const statusBadge = w.status === 'active' ? 'badge-active' : 'badge-inactive';

                    return `
                    <div class="employee-card">
                        <div class="employee-avatar">${initial}</div>
                        <div class="employee-info">
                            <div class="employee-name-row">
                                <span class="employee-name">${fullName}</span>
                                <span class="badge-role badge-worker">Сотрудник</span>
                                <span class="badge-role ${statusBadge}">${statusLabel}</span>
                            </div>
                            <div class="employee-detail">${w.email || ''}</div>
                            <div class="employee-detail">${w.phone || 'Телефон не указан'}</div>
                        </div>
                        <div class="employee-actions">
                            <div style="text-align: center;">
                                <div style="font-size: 24px; font-weight: 700; color: #0b1e8e;">${w.activeOrdersCount}</div>
                                <div style="font-size: 12px; color: #6b7280;">активных заказов</div>
                            </div>
                        </div>
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">В бригаде нет сотрудников</div>'}
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить сотрудников бригады</div>';
    }
}

// ─── Универсальная модалка назначения (бригада / сотрудник) ────
function showAssignModal({ title, label, options, onSubmit }) {
    // Удаляем старую модалку если есть
    const old = document.querySelector('.assign-modal-overlay');
    if (old) old.remove();

    const optionsHtml = options.map(o =>
        `<option value="${o.value}">${o.text}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'assign-modal-overlay';
    overlay.innerHTML = `
        <div class="assign-modal">
            <div class="assign-modal-header">
                <h3>${title}</h3>
                <button class="assign-modal-close">&times;</button>
            </div>
            <div class="assign-modal-body">
                <label class="assign-modal-label">${label}</label>
                <select class="assign-modal-select" id="assign-modal-select">
                    <option value="">— Выберите —</option>
                    ${optionsHtml}
                </select>
            </div>
            <div class="assign-modal-footer">
                <button class="btn-secondary assign-modal-cancel">Отмена</button>
                <button class="btn-primary assign-modal-submit"><i class="fa-solid fa-check"></i> Подтвердить</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Закрытие
    const close = () => overlay.remove();
    overlay.querySelector('.assign-modal-close').addEventListener('click', close);
    overlay.querySelector('.assign-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Подтверждение
    overlay.querySelector('.assign-modal-submit').addEventListener('click', async () => {
        const select = overlay.querySelector('#assign-modal-select');
        const value = select.value;
        if (!value) {
            select.style.borderColor = '#e53e3e';
            return;
        }
        const submitBtn = overlay.querySelector('.assign-modal-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Назначаю...';
        try {
            await onSubmit(value);
            close();
        } catch (err) {
            alert('Ошибка назначения');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Подтвердить';
        }
    });
}

// ─── Вкладка "Сборка заказов" для сотрудника ──────────────────
async function renderPickingTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка ваших заказов...</div>';
    updateHeader('Сборка заказов', 'Соберите текущий заказ товар за товаром');

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch('http://localhost:5000/orders/worker/my-orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Ошибка загрузки');
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">У вас пока нет назначенных заказов</div>';
            return;
        }

        // Берем активный заказ (workerQueueStatus === 'active')
        const activeOrder = orders.find(o => o.workerQueueStatus === 'active') || orders[0];
        const queuedOrder = orders.find(o => o.workerQueueStatus === 'queued');

        // Ищем первый неупакованный товар в активном заказе
        const items = activeOrder.items || [];
        const currentItemIndex = items.findIndex(i => !i.isPacked);
        const allPacked = currentItemIndex === -1 && items.length > 0;
        const currentItem = allPacked ? null : items[currentItemIndex];

        // Прогресс
        const packedCount = items.filter(i => i.isPacked).length;
        const totalCount = items.length;
        const progressPercent = totalCount > 0 ? (packedCount / totalCount) * 100 : 0;

        let activeHtml = '';
        if (allPacked) {
            activeHtml = `
                <div class="picking-item-step">
                    <div style="font-size: 48px; color: #10b981; margin-bottom: 10px;"><i class="fa-solid fa-circle-check"></i></div>
                    <div class="picking-item-name">Заказ #${activeOrder.id} собран!</div>
                    <p style="color: #6b7280;">Все товары упакованы. Сообщите бригадиру о готовности.</p>
                </div>
            `;
        } else if (currentItem) {
            activeHtml = `
                <div class="picking-item-step">
                    <div class="picking-item-name">${currentItem.product?.name || 'Товар'} × ${currentItem.quantity}</div>
                    <div class="picking-location-grid">
                        <div class="location-card">
                            <span class="location-label">Отдел</span>
                            <span class="location-value">${currentItem.product?.department || '—'}</span>
                        </div>
                        <div class="location-card">
                            <span class="location-label">Ячейка</span>
                            <span class="location-value">${currentItem.product?.storageCell || '—'}</span>
                        </div>
                    </div>
                    <div class="picking-actions">
                        <button class="btn-primary btn-pack-item" data-item-id="${currentItem.id}" style="padding: 12px 32px; font-size: 16px;">
                            <i class="fa-solid fa-box"></i> Упаковано
                        </button>
                    </div>
                </div>
            `;
        }

        let queuedHtml = '';
        if (queuedOrder) {
            queuedHtml = `
                <div class="picking-queued-box">
                    <div class="queued-header">
                        <i class="fa-solid fa-clock"></i> Следующий в очереди
                    </div>
                    <div style="font-size: 14px; color: #1e2937; font-weight: 600;">Заказ #${queuedOrder.id}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Товаров: ${queuedOrder.items?.length || 0}</div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="picking-container">
                <div class="picking-active-box">
                    <div class="picking-header">
                        <h3>Заказ #${activeOrder.id}</h3>
                    </div>
                    ${activeHtml}
                    <div class="picking-progress">
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progressPercent}%"></div></div>
                        <span style="font-size: 13px; font-weight: 600; color: #374151;">${packedCount}/${totalCount}</span>
                        ${packedCount > 0 ? `<button class="btn-unassign btn-undo-pack" data-item-id="${items[packedCount-1].id}" style="text-decoration:none; color:#6b7280; display:flex; align-items:center; gap:4px; font-size:12px;"><i class="fa-solid fa-rotate-left"></i> Назад</button>` : ''}
                    </div>
                </div>
                ${queuedHtml}
            </div>
        `;

        // Обработка клика "Упаковано"
        const packBtn = container.querySelector('.btn-pack-item');
        if (packBtn) {
            packBtn.addEventListener('click', async () => {
                const itemId = packBtn.getAttribute('data-item-id');
                const originalText = packBtn.innerHTML;
                packBtn.disabled = true;
                packBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const res = await fetch(`http://localhost:5000/orders/items/${itemId}/pack`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ packed: true })
                    });
                    if (!res.ok) throw new Error('Ошибка');
                    renderPickingTab(container);
                } catch (err) { 
                    alert('Не удалось обновить статус');
                    packBtn.disabled = false;
                    packBtn.innerHTML = originalText;
                }
            });
        }

        // Обработка клика "Назад" (Undo)
        const undoBtn = container.querySelector('.btn-undo-pack');
        if (undoBtn) {
            undoBtn.addEventListener('click', async () => {
                const itemId = undoBtn.getAttribute('data-item-id');
                try {
                    const res = await fetch(`http://localhost:5000/orders/items/${itemId}/pack`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ packed: false })
                    });
                    if (!res.ok) throw new Error('Ошибка');
                    renderPickingTab(container);
                } catch (err) { alert('Не удалось отменить'); }
            });
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить данные</div>';
    }
}
