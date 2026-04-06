document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('adminToken');

    // Редирект на логин при отсутствии токена
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Загрузка профиля пользователя
        const response = await fetch('http://localhost:5000/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Токен недействителен');

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
    window.currentUser = user;
    const firstName = user.firstName || 'Пользователь';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    document.getElementById('user-name').textContent = fullName;
    document.getElementById('user-avatar').textContent = firstName.charAt(0).toUpperCase();

    // Маппинг ролей для интерфейса
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
    { id: 'teams_manager', title: 'Управление бригадами', icon: 'fa-solid fa-people-group', subtitle: 'Создание и редактирование бригад', roles: ['senior_manager'] },
    { id: 'employees', title: 'Сотрудники', icon: 'fa-solid fa-user-tie', subtitle: 'Управление персоналом и правами', roles: ['senior_manager'] },
    { id: 'orders_foreman', title: 'Заказы бригады', icon: 'fa-solid fa-clipboard-list', subtitle: 'Назначение заказов сотрудникам', roles: ['foreman'] },
    { id: 'team_members', title: 'Сотрудники бригады', icon: 'fa-solid fa-users', subtitle: 'Список сотрудников вашей бригады', roles: ['foreman'] },
    { id: 'picking', title: 'Сборка заказов', icon: 'fa-solid fa-box-open', subtitle: 'Сбор текущего заказа по ячейкам', roles: ['worker'] }
];

function renderSidebarMenu(userRoleName) {
    const menuContainer = document.getElementById('sidebar-menu');
    menuContainer.innerHTML = '';

    const availableTabs = ALL_TABS.filter(tab => tab.roles.includes(userRoleName));

    if (availableTabs.length === 0) {
        updateHeader('', '');
        document.getElementById('content-area').innerHTML = '';
        return;
    }

    availableTabs.forEach((tab, index) => {
        const item = document.createElement('a');
        item.className = 'menu-item';

        // Активация первой доступной вкладки
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

// Отрисовка контента конкретной вкладки
function renderTabContent(tabId) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = ''; 

    const stubStyle = "padding: 40px; text-align: center; background: #fff; border-radius: 8px; border: 1px dashed #ccc; margin: 20px;";

    if (tabId === 'orders_manager') {
        renderManagerOrdersTab(contentArea);
        return;
    } else if (tabId === 'teams_manager') {
        renderTeamsManagerTab(contentArea);
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

// Статусы заказов
const statusMap = {
    'new': { label: 'Новый', class: 'badge-processing' },
    'processing': { label: 'В обработке', class: 'badge-processing' },
    'shipped': { label: 'Отправлен', class: 'badge-shipped' },
    'delivered': { label: 'Доставлен', class: 'badge-delivered' },
    'cancelled': { label: 'Отменен', class: 'badge-processing' }
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

// Загрузка и рендер списка заказов
async function renderOrdersTab(container) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов...</div>`;

    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('http://localhost:5000/orders/admin/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Ошибка загрузки заказов');

        const data = await response.json();
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
async function renderEmployeesTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка сотрудников...</div>';

    updateHeader('Управление сотрудниками', 'Добавление сотрудников и настройка прав доступа',
        '<button class="btn-primary" id="btn-add-employee"><i class="fa-solid fa-plus"></i> Добавить сотрудника</button>');

    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('http://localhost:5000/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки сотрудников');

        const allEmployees = await response.json();

        // Собираем уникальные бригады для фильтра
        const teamNames = [...new Set(allEmployees.map(e => e.team?.name || e.managedTeam?.name).filter(Boolean))].sort();

        const roleNameMap = { 'senior_manager': 'Старший менеджер', 'foreman': 'Бригадир', 'worker': 'Сборщик' };
        const roleBadgeClass = { 'senior_manager': 'badge-foreman', 'foreman': 'badge-foreman', 'worker': 'badge-worker' };

        const filterBar = `
            <div class="orders-toolbar" style="flex-wrap:wrap; gap:10px;">
                <div class="search-box" style="flex:1; min-width:200px;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="emp-search" placeholder="Поиск по имени, логину, email...">
                </div>
                <div class="filter-box">
                    <i class="fa-solid fa-user-tag"></i>
                    <select class="filter-select" id="filter-role">
                        <option value="">Все роли</option>
                        <option value="senior_manager">Старший менеджер</option>
                        <option value="foreman">Бригадир</option>
                        <option value="worker">Сборщик</option>
                    </select>
                </div>
                <div class="filter-box">
                    <i class="fa-solid fa-circle-dot"></i>
                    <select class="filter-select" id="filter-status">
                        <option value="">Все статусы</option>
                        <option value="active">В сети</option>
                        <option value="inactive">Не в сети</option>
                    </select>
                </div>
                <div class="filter-box">
                    <i class="fa-solid fa-people-group"></i>
                    <select class="filter-select" id="filter-team">
                        <option value="">Все бригады</option>
                        <option value="__free__">Свободные</option>
                        ${teamNames.map(n => `<option value="${n}">${n}</option>`).join('')}
                    </select>
                </div>
            </div>`;

        const renderCards = (list) => {
            if (list.length === 0) {
                return '<div style="padding: 30px; text-align: center; color: #666;">Сотрудников не найдено</div>';
            }
            return list.map(emp => {
                const fullName = ((emp.firstName || '') + ' ' + (emp.lastName || '')).trim() || emp.username;
                const initial = (emp.firstName || emp.username || '?').charAt(0).toUpperCase();
                const roleName = emp.roleName || (emp.role && emp.role.name) || 'worker';
                const roleLabel = roleNameMap[roleName] || roleName;
                const roleBadge = roleBadgeClass[roleName] || 'badge-worker';
                const statusLabel = emp.status === 'active' ? 'В сети' : 'Не в сети';
                const statusBadge = emp.status === 'active' ? 'badge-active' : 'badge-inactive';

                const teamName = emp.team?.name || emp.managedTeam?.name || null;

                const teamEl = teamName
                    ? `<div class="employee-team-row">
                           <i class="fa-solid fa-users"></i>
                           <span class="employee-team-label">Бригада: ${teamName}</span>
                       </div>`
                    : `<div class="employee-team-row">
                           <i class="fa-solid fa-user-slash" style="color:#d1d5db"></i>
                           <span class="employee-team-label" style="color:#9ca3af">Свободен</span>
                       </div>`;

                return `
                <div class="employee-card" data-id="${emp.id}" data-role="${roleName}" data-status="${emp.status}" data-team="${teamName || ''}">
                    <div class="employee-avatar">${initial}</div>
                    <div class="employee-info">
                        <div class="employee-name-row">
                            <span class="employee-name">${fullName}</span>
                            <span class="badge-role ${roleBadge}">${roleLabel}</span>
                            <span class="badge-role ${statusBadge}">${statusLabel}</span>
                        </div>
                        <div class="employee-detail">${emp.email || ''}</div>
                        <div class="employee-detail">${emp.phone || 'Телефон не указан'}</div>
                        ${teamEl}
                    </div>
                    <div class="employee-actions">
                        <button class="btn-icon-sm btn-danger" data-delete-id="${emp.id}" title="Удалить сотрудника">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
        };

        container.innerHTML = `
            ${filterBar}
            <div class="employees-list" id="employees-list-container">
                ${renderCards(allEmployees)}
            </div>`;

        // ─── Фильтрация на клиенте ────────────────────────────────────────────
        const applyFilters = () => {
            const search = container.querySelector('#emp-search')?.value.toLowerCase() || '';
            const role   = container.querySelector('#filter-role')?.value || '';
            const status = container.querySelector('#filter-status')?.value || '';
            const team   = container.querySelector('#filter-team')?.value || '';

            const filtered = allEmployees.filter(emp => {
                const fullName = ((emp.firstName || '') + ' ' + (emp.lastName || '')).toLowerCase();
                const matchSearch = !search || fullName.includes(search) || (emp.username || '').toLowerCase().includes(search) || (emp.email || '').toLowerCase().includes(search);
                const empRole = emp.roleName || (emp.role && emp.role.name) || '';
                const matchRole = !role || empRole === role;
                const matchStatus = !status || emp.status === status;
                const empTeamName = emp.team?.name || emp.managedTeam?.name || null;
                const matchTeam = !team || (team === '__free__' ? !empTeamName : empTeamName === team);
                return matchSearch && matchRole && matchStatus && matchTeam;
            });

            const listContainer = container.querySelector('#employees-list-container');
            if (listContainer) listContainer.innerHTML = renderCards(filtered);

            // Перепривязываем обработчики удаления
            attachDeleteHandlers();
        };

        const attachDeleteHandlers = () => {
            container.querySelectorAll('[data-delete-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const empId = btn.getAttribute('data-delete-id');
                    if (!confirm('Вы уверены, что хотите удалить сотрудника? Это действие необратимо.')) return;
                    try {
                        const res = await fetch(`http://localhost:5000/employees/${empId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!res.ok) throw new Error();
                        renderEmployeesTab(container);
                    } catch {
                        alert('Ошибка удаления сотрудника');
                    }
                });
            });
        };

        // Вешаем обработчики фильтров
        ['#emp-search', '#filter-role', '#filter-status', '#filter-team'].forEach(sel => {
            container.querySelector(sel)?.addEventListener('input', applyFilters);
            container.querySelector(sel)?.addEventListener('change', applyFilters);
        });

        // Первичная привязка удаления
        attachDeleteHandlers();

        // ─── Кнопка "Добавить сотрудника" ─────────
        const addBtn = document.getElementById('btn-add-employee');
        if (addBtn) {
            addBtn.addEventListener('click', () => showAddEmployeeModal(container));
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
            const res = await fetch('http://localhost:5000/employees', {
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
    if (!container.querySelector('.orders-toolbar')) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов...</div>';
    }
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

        const allOrders = await ordersRes.json();
        const teams = await teamsRes.json();

        const statusLabels = {
            'new': 'Новый',
            'processing': 'В обработке',
            'in_progress': 'В работе',
            'packed': 'Упакован',
            'ready': 'Готов',
            'delivered': 'Доставлен',
        };

        const renderOrders = (orders) => {
            if (orders.length === 0) {
                return '<div style="padding: 30px; text-align: center; color: #666;">Нет заказов</div>';
            }
            return orders.map(order => {
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

                const isFinished = ['packed', 'ready', 'delivered'].includes(order.status);
                const actionBtn = isFinished
                    ? `<span style="font-size:13px; color:#6b7280;"><i class="fa-solid fa-lock"></i> Завершён</span>`
                    : assignedTeamName
                        ? `<div class="order-team-assigned" style="display:flex; align-items:center;">
                             <i class="fa-solid fa-users"></i> ${assignedTeamName}
                             <button class="btn-unassign btn-manager-unassign" data-order-id="${order.id}">Снять бригаду</button>
                           </div>`
                        : `<button class="btn-primary btn-open-assign" data-order-id="${order.id}" style="padding:8px 16px; font-size:13px;"><i class="fa-solid fa-user-plus"></i> Назначить</button>`;

                return `
                <div class="order-card" data-order-id="${order.id}" data-status="${order.status || ''}">
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
                    <div class="order-actions">${actionBtn}</div>
                </div>`;
            }).join('');
        };

        // Рендерим оболочку ТОЛЬКО если ее еще нет
        if (!container.querySelector('.orders-toolbar')) {
            container.innerHTML = `
                <div class="orders-toolbar" style="flex-wrap:wrap; gap:10px;">
                    <div class="search-box" style="flex:1; min-width:200px;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="manager-order-search" placeholder="Поиск по номеру заказа или клиенту...">
                    </div>
                    <div class="filter-box">
                        <i class="fa-solid fa-filter"></i>
                        <select class="filter-select" id="manager-status-filter">
                            <option value="all">Все заказы</option>
                            <option value="unassigned">📌 Ожидают назначения</option>
                            <option value="active">⚡ В работе / Сборке</option>
                            <option value="completed">✅ Завершенные</option>
                        </select>
                    </div>
                </div>
                <div class="orders-list" id="orders-list-container"></div>
            `;
            
            // Навешиваем обработчики на фильтры один раз
            container.querySelector('#manager-order-search')?.addEventListener('input', applyOrderFilters);
            container.querySelector('#manager-status-filter')?.addEventListener('change', applyOrderFilters);
        }

        const attachHandlers = () => {
            // Снять бригаду
            container.querySelectorAll('.btn-manager-unassign').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Снять бригаду с этого заказа?')) return;
                    const orderId = btn.getAttribute('data-order-id');
                    try {
                        const res = await fetch(`http://localhost:5000/orders/${orderId}/unassign-team`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!res.ok) throw new Error();
                        renderManagerOrdersTab(container);
                    } catch { alert('Ошибка при снятии бригады'); }
                });
            });

            // Назначить бригаду
            container.querySelectorAll('.btn-open-assign').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.getAttribute('data-order-id');
                    showAssignModal({
                        title: 'Назначить бригаду на заказ #' + orderId,
                        label: 'Выберите бригаду (заказов в работе указано рядом)',
                        options: teams.map(t => {
                            const fn = (t.foreman.firstName + ' ' + t.foreman.lastName).trim();
                            const activeOrders = t._count?.orders ?? 0;
                            const load = activeOrders === 0 ? '✅ свободна' : `⚡ ${activeOrders} зак.`;
                            return { value: t.id, text: `${t.name} — ${load} · бригадир: ${fn} · ${t._count.workers} раб.` };
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
        };

        // Вызываем применение фильтров для инициализации (и привязки обработчиков)
        function applyOrderFilters() {
            const query = (container.querySelector('#manager-order-search')?.value || '').toLowerCase();
            const statusFilter = container.querySelector('#manager-status-filter')?.value || '';

            const filtered = allOrders.filter(o => {
                const num = String(o.id);
                const client = ((o.user?.firstName || '') + ' ' + (o.user?.lastName || '')).toLowerCase();
                const matchSearch = !query || num.includes(query) || client.includes(query);
                
                let matchStatus = true;
                if (statusFilter === 'unassigned') {
                    matchStatus = !o.assignedTeamId;
                } else if (statusFilter === 'active') {
                    const completedStatuses = ['packed', 'ready', 'delivered'];
                    matchStatus = o.assignedTeamId && !completedStatuses.includes(o.status);
                } else if (statusFilter === 'completed') {
                    const completedStatuses = ['packed', 'ready', 'delivered'];
                    matchStatus = completedStatuses.includes(o.status);
                }
                
                return matchSearch && matchStatus;
            });

            const listEl = container.querySelector('#orders-list-container');
            if (listEl) listEl.innerHTML = renderOrders(filtered);
            attachHandlers();
        }

        applyOrderFilters();

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить заказы</div>';
    }
}

// --- Global Poller ---
// Авто-обновление страниц (10 секунд)
setInterval(() => {
    const activeTab = document.querySelector('.menu-item.active');
    if (!activeTab) return;
    const tabName = activeTab.textContent.trim();
    const container = document.getElementById('content-area');
    
    // Only auto-update the main order management tabs
    if (tabName === 'Все заказы' && typeof renderManagerOrdersTab === 'function') {
        renderManagerOrdersTab(container);
    } else if (tabName === 'Заказы бригады' && typeof renderForemanOrdersTab === 'function') {
        renderForemanOrdersTab(container);
    } else if (tabName === 'Сборка заказов' && typeof renderPickingTab === 'function') {
        renderPickingTab(container);
    }
}, 10000);
// ─── Вкладка "Заказы бригады" для бригадира ───────────────────
async function renderForemanOrdersTab(container) {
    if (!container.querySelector('.orders-toolbar')) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка заказов бригады...</div>';
    }

    updateHeader('Заказы бригады', 'Распределение заказов по сотрудникам');

    const token = localStorage.getItem('adminToken');
    let orders = [];
    let workers = [];

    const loadDataAndRender = async () => {
        try {
            const [ordersRes, membersRes] = await Promise.all([
                fetch('http://localhost:5000/orders/foreman/team-orders', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/orders/foreman/team-members', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!ordersRes.ok || !membersRes.ok) {
                throw new Error('Ошибка загрузки данных бригады');
            }

            orders = await ordersRes.json();
            const membersData = await membersRes.json();
            workers = membersData.members || [];
            
            applyForemanFilters();
        } catch(e) {
            console.error(e);
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить заказы бригады</div>';
        }
    };

    if (!container.querySelector('.orders-toolbar')) {
        container.innerHTML = `
            <div class="orders-toolbar" style="flex-wrap:wrap; gap:10px;">
                <div class="search-box" style="flex:1; min-width:200px;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="foreman-order-search" placeholder="Поиск по номеру заказа или клиенту...">
                </div>
            </div>
            <div class="orders-list" id="foreman-orders-list"></div>
        `;
        container.querySelector('#foreman-order-search')?.addEventListener('input', applyForemanFilters);
    }

    const renderForemanOrders = (orderList) => {
        if (orderList.length === 0) {
            return '<div style="padding: 30px; text-align: center; color: #666;">Нет заказов для распределения</div>';
        }
        return orderList.map(order => {
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
        }).join('');
    };

    function applyForemanFilters() {
        const query = (container.querySelector('#foreman-order-search')?.value || '').toLowerCase();
        const filtered = orders.filter(o => {
            const num = String(o.id);
            const client = ((o.user?.firstName || '') + ' ' + (o.user?.lastName || '')).toLowerCase();
            return !query || num.includes(query) || client.includes(query);
        });
        const listEl = container.querySelector('#foreman-orders-list');
        if (listEl) {
            listEl.innerHTML = renderForemanOrders(filtered);
            attachForemanHandlers();
        }
    }

    const attachForemanHandlers = () => {
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
                    await loadDataAndRender();
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
                    options: workers
                        .filter(w => !w.breakStatus || w.breakStatus === 'working')
                        .map(w => {
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
                        await loadDataAndRender();
                    }
                });
            });
        });
    }; // End attachForemanHandlers

    await loadDataAndRender();
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

                    let breakAction = '';
                    if (w.breakStatus === 'break_requested') {
                        breakAction = `<button class="btn-primary btn-approve-break" data-worker-id="${w.id}" style="margin-top: 8px; font-size: 12px; padding: 4px 8px;">Одобрить перерыв</button>`;
                    } else if (w.breakStatus === 'break_approved') {
                        breakAction = `<div style="margin-top: 8px; font-size: 12px; color: #f59e0b;"><i class="fa-solid fa-hourglass-half"></i> Завершает заказ (перерыв)</div>`;
                    } else if (w.breakStatus === 'on_break') {
                        breakAction = `<div style="margin-top: 8px; font-size: 12px; color: #f59e0b;"><i class="fa-solid fa-mug-hot"></i> На перерыве</div>`;
                    }

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
                                ${breakAction}
                            </div>
                        </div>
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">В бригаде нет сотрудников</div>'}
            </div>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.btn-approve-break').forEach(btn => {
            btn.addEventListener('click', async () => {
                const workerId = btn.getAttribute('data-worker-id');
                const originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const response = await fetch(`http://localhost:5000/employees/${workerId}/break/approve`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error();
                    renderTeamMembersTab(container);
                } catch {
                    alert('Ошибка одобрения перерыва');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            });
        });

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

    const optionsHtml = options.map(o => {
        const sel = o.selected ? 'selected' : '';
        return `<option value="${o.value}" ${sel}>${o.text}</option>`;
    }).join('');

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

// ─── Расширенная модалка редактирования/создания бригады ─────────────
function showEditTeamModal({ team, employees, onSave, onAddWorker, onRemoveWorker, onClose }) {
    const old = document.querySelector('.assign-modal-overlay');
    if (old) old.remove();

    const isCreate = !team.id;

    // Все бригадиры по роли
    const allForemen = employees.filter(e => e.role && e.role.name === 'foreman');
    // Свободные сборщики (без бригады)
    const freeWorkers = employees.filter(e => e.role && e.role.name === 'worker' && !e.team);
    // Текущие сборщики этой бригады
    const currentWorkers = isCreate ? [] : employees.filter(e => e.team && e.team.id === team.id);

    const foremenOptions = allForemen.map(f => {
        const isBusy = !!(f.managedTeam && f.managedTeam.id !== team.id);
        const isCurrent = f.id === team.foremanId;
        const sel = isCurrent ? 'selected' : '';
        const tag = isCurrent ? ' ✓ Текущий' : isBusy ? ` (руководит: ${f.managedTeam.name})` : ' — свободен';
        return `<option value="${f.id}" ${sel} style="color:${isBusy ? '#9ca3af' : '#1a1a1a'}">${f.firstName} ${f.lastName}${tag}</option>`;
    }).join('');

    const freeWorkersOptions = freeWorkers.length > 0
        ? freeWorkers.map(w => `<option value="${w.id}">${w.firstName} ${w.lastName} — ${w.email}</option>`).join('')
        : '<option value="" disabled>Нет свободных сборщиков</option>';

    const workersListHtml = currentWorkers.length > 0
        ? currentWorkers.map(w => `
            <div class="team-member-row" data-worker-id="${w.id}">
                <div>
                    <span style="font-size:14px; font-weight:500;">${w.firstName} ${w.lastName}</span>
                    <div style="font-size:12px; color:#6b7280;">${w.email}</div>
                </div>
                <button class="btn-delete btn-remove-worker" data-id="${w.id}" style="padding:4px 10px; font-size:12px;">
                    <i class="fa-solid fa-user-minus"></i> Убрать
                </button>
            </div>`).join('')
        : `<div style="padding:12px; text-align:center; color:#9ca3af; font-size:13px;">В бригаде пока нет сборщиков</div>`;

    const overlay = document.createElement('div');
    overlay.className = 'assign-modal-overlay';
    overlay.innerHTML = `
        <div class="assign-modal" style="width:580px; max-width:95vw;">
            <div class="assign-modal-header">
                <h3>${isCreate ? 'Создать бригаду' : 'Редактировать бригаду'}</h3>
                <button class="assign-modal-close">&times;</button>
            </div>
            <div class="assign-modal-body" style="display:flex; flex-direction:column; gap:16px;">

                <div>
                    <label class="assign-modal-label">Название бригады</label>
                    <input type="text" id="edit-team-name" value="${team.name || ''}" placeholder="Например: Бригада Альфа"
                        style="width:100%; padding:10px 12px; border:1px solid #e1e4e8; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box;">
                </div>

                <div>
                    <label class="assign-modal-label">Бригадир
                        <span style="font-weight:400; color:#6b7280; margin-left:4px;">(выделены занятые)</span>
                    </label>
                    <select id="edit-team-foreman" style="width:100%; padding:10px 12px; border:1px solid #e1e4e8; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box;">
                        ${!team.foremanId ? '<option value="">— Выберите бригадира —</option>' : ''}
                        ${foremenOptions}
                    </select>
                </div>

                ${!isCreate ? `
                <div style="border-top:1px solid #e5e7eb; padding-top:16px;">
                    <h4 style="font-size:14px; font-weight:600; margin-bottom:10px; color:#374151;">Сборщики в бригаде</h4>
                    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:12px;">
                        <div id="workers-list" style="max-height:180px; overflow-y:auto;">${workersListHtml}</div>
                    </div>
                    <label class="assign-modal-label">Добавить свободного сборщика</label>
                    <div style="display:flex; gap:8px;">
                        <select id="add-worker-select" style="flex:1; padding:10px 12px; border:1px solid #e1e4e8; border-radius:8px; font-size:14px; outline:none;">
                            <option value="">— Выберите сборщика —</option>
                            ${freeWorkersOptions}
                        </select>
                        <button class="btn-primary" id="btn-add-worker" style="padding:10px 16px; white-space:nowrap;">
                            <i class="fa-solid fa-plus"></i> Добавить
                        </button>
                    </div>
                </div>` : ''}
            </div>
            <div class="assign-modal-footer">
                <button class="btn-secondary assign-modal-cancel">Отмена</button>
                <button class="btn-primary" id="btn-save-team">
                    <i class="fa-solid fa-${isCreate ? 'plus' : 'check'}"></i> ${isCreate ? 'Создать бригаду' : 'Сохранить'}
                </button>
            </div>
        </div>
    `;

    // Стиль для строк участников
    const style = document.createElement('style');
    style.textContent = `.team-member-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f3f4f6; } .team-member-row:last-child { border-bottom:none; }`;
    overlay.appendChild(style);

    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); if (onClose) onClose(); };
    overlay.querySelector('.assign-modal-close').addEventListener('click', close);
    overlay.querySelector('.assign-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // ── Сохранить основные параметры ──
    overlay.querySelector('#btn-save-team').addEventListener('click', async () => {
        const btn = overlay.querySelector('#btn-save-team');
        const name = overlay.querySelector('#edit-team-name').value.trim();
        const foremanId = overlay.querySelector('#edit-team-foreman').value;
        if (!name) { alert('Введите название бригады'); return; }
        if (!foremanId) { alert('Выберите бригадира'); return; }
        const isBusyForeman = allForemen.find(f => f.id === Number(foremanId));
        if (isBusyForeman && isBusyForeman.managedTeam && isBusyForeman.managedTeam.id !== team.id) {
            if (!confirm(`${isBusyForeman.firstName} ${isBusyForeman.lastName} уже руководит бригадой "${isBusyForeman.managedTeam.name}". Заменить?`)) return;
        }
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            await onSave({ name, foremanId: Number(foremanId) });
            if (isCreate) close();
            else btn.innerHTML = '<i class="fa-solid fa-check"></i> Сохранено!';
        } catch (err) {
            alert(err.message || 'Ошибка сохранения');
            btn.innerHTML = orig;
        }
        btn.disabled = false;
    });

    // ── Убрать сборщика ──
    if (!isCreate) {
        overlay.querySelectorAll('.btn-remove-worker').forEach(btn => {
            btn.addEventListener('click', async () => {
                const wId = btn.getAttribute('data-id');
                const orig = btn.innerHTML;
                btn.innerHTML = '...';
                btn.disabled = true;
                try {
                    await onRemoveWorker(wId);
                    const row = overlay.querySelector(`.team-member-row[data-worker-id="${wId}"]`);
                    if (row) row.remove();
                    const list = overlay.querySelector('#workers-list');
                    if (list && list.children.length === 0) {
                        list.innerHTML = '<div style="padding:12px; text-align:center; color:#9ca3af; font-size:13px;">В бригаде пока нет сборщиков</div>';
                    }
                } catch { btn.innerHTML = orig; btn.disabled = false; }
            });
        });

        // ── Добавить сборщика ──
        overlay.querySelector('#btn-add-worker').addEventListener('click', async () => {
            const btn = overlay.querySelector('#btn-add-worker');
            const sel = overlay.querySelector('#add-worker-select');
            const wId = sel.value;
            if (!wId) return;
            const origH = btn.innerHTML;
            btn.innerHTML = '...';
            btn.disabled = true;
            try {
                await onAddWorker(wId);
                // Убираем из дропдауна и добавляем в список
                const opt = sel.querySelector(`option[value="${wId}"]`);
                const wName = opt ? opt.text : `#${wId}`;
                opt?.remove();
                sel.value = '';
                const list = overlay.querySelector('#workers-list');
                const empty = list.querySelector('div[style*="text-align:center"]');
                if (empty) empty.remove();
                const div = document.createElement('div');
                div.className = 'team-member-row';
                div.setAttribute('data-worker-id', wId);
                div.innerHTML = `<div><span style="font-size:14px;font-weight:500;">${wName.split(' — ')[0]}</span><div style="font-size:12px;color:#6b7280;">${wName.split(' — ')[1] || ''}</div></div>
                    <button class="btn-delete btn-remove-worker" data-id="${wId}" style="padding:4px 10px; font-size:12px;"><i class="fa-solid fa-user-minus"></i> Убрать</button>`;
                // Повесить обработчик на новую кнопку
                div.querySelector('.btn-remove-worker').addEventListener('click', async (e) => {
                    const b = e.currentTarget;
                    const o = b.innerHTML; b.innerHTML = '...'; b.disabled = true;
                    try { await onRemoveWorker(wId); div.remove(); } catch { b.innerHTML = o; b.disabled = false; }
                });
                list.appendChild(div);
            } catch (err) {
                alert(err.message || 'Ошибка');
            }
            btn.innerHTML = origH;
            btn.disabled = false;
        });
    }
}


// ─── Вкладка "Сборка заказов" для сотрудника ──────────────────
async function renderPickingTab(container) {
    if (!container.querySelector('.picking-container')) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка ваших заказов...</div>';
    }
    updateHeader('Сборка заказов', 'Соберите текущий заказ товар за товаром');

    const token = localStorage.getItem('adminToken');
    try {
        const [resParams, userRes] = await Promise.all([
            fetch('http://localhost:5000/orders/worker/orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('http://localhost:5000/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        if (!resParams.ok) throw new Error('Ошибка загрузки заказов');
        const orders = await resParams.json();
        const me = await userRes.json();
        const breakStatus = me.breakStatus || 'working';

        if (breakStatus === 'on_break') {
            container.innerHTML = `
                <div style="padding: 60px 40px; text-align: center;">
                    <div style="font-size: 64px; color: #f59e0b; margin-bottom: 20px;"><i class="fa-solid fa-mug-hot"></i></div>
                    <h2 style="color: #1f2937; margin-bottom: 10px;">Вы на перерыве</h2>
                    <p style="color: #6b7280; margin-bottom: 30px;">Отдохните и возвращайтесь с новыми силами!</p>
                    <button class="btn-primary btn-end-break" style="padding: 12px 32px; font-size: 16px;">
                        <i class="fa-solid fa-briefcase"></i> Вернуться к работе
                    </button>
                </div>
            `;
            container.querySelector('.btn-end-break').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const orig = btn.innerHTML; btn.innerHTML = '...'; btn.disabled = true;
                try {
                    await fetch('http://localhost:5000/employees/break/end', { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } });
                    renderPickingTab(container);
                } catch { btn.innerHTML = orig; btn.disabled = false; }
            });
            return;
        }

        if (orders.length === 0) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">У вас пока нет назначенных заказов</div>';
            return;
        }

        // Берем активный заказ (workerQueueStatus === 'active')
        const activeOrder = orders.find(o => o.workerQueueStatus === 'active') || orders[0];
        const queuedOrder = orders.find(o => o.workerQueueStatus === 'queued' && o.id !== activeOrder.id);

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
                    <p style="color: #6b7280;">Все товары упакованы. Нажмите "Завершить заказ", чтобы сдать его.</p>
                    <button class="btn-primary btn-finish-picking" data-order-id="${activeOrder.id}" style="margin-top:20px; padding: 12px 32px; font-size: 18px;">
                        <i class="fa-solid fa-flag-checkered"></i> Завершить заказ
                    </button>
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
                        <button class="btn-secondary btn-item-error" data-item-id="${currentItem.id}" style="padding: 12px 32px; font-size: 16px; margin-top: 10px; color: #dc2626; border-color: #fca5a5;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Нет в ячейке / Ошибка
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
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                    ${breakStatus === 'working' ? `<button class="btn-secondary btn-request-break"><i class="fa-solid fa-mug-hot"></i> Уйти на перерыв</button>` :
                      breakStatus === 'break_requested' ? `<button class="btn-secondary" disabled style="opacity:0.7"><i class="fa-solid fa-clock"></i> Ожидает одобрения</button>` :
                      breakStatus === 'break_approved' ? `<button class="btn-secondary" disabled style="opacity:0.7; color:#f59e0b; border-color:#fef3c7;"><i class="fa-solid fa-hourglass-half"></i> Доработайте заказ</button>` : ''}
                </div>
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

        // Обработка клика "Ошибка товара"
        const errorBtn = container.querySelector('.btn-item-error');
        if (errorBtn) {
            errorBtn.addEventListener('click', async () => {
                const itemId = errorBtn.getAttribute('data-item-id');
                if (!confirm('Отметить товар как проблемный (отсутствует или брак)? Это повлияет на ваш % ошибок.')) return;
                
                try {
                    const res = await fetch(`http://localhost:5000/orders/items/${itemId}/pack`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ packed: true, hasError: true })
                    });
                    if (!res.ok) throw new Error('Ошибка');
                    renderPickingTab(container);
                } catch (err) { alert('Не удалось обновить статус'); }
            });
        }

        // Обработка "Завершить заказ"
        const finishBtn = container.querySelector('.btn-finish-picking');
        if (finishBtn) {
            finishBtn.addEventListener('click', async () => {
                const orderId = finishBtn.getAttribute('data-order-id');
                const orig = finishBtn.innerHTML;
                finishBtn.disabled = true;
                finishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const res = await fetch(`http://localhost:5000/orders/${orderId}/finish-picking`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error('Ошибка');
                    renderPickingTab(container);
                } catch (err) {
                    alert('Не удалось завершить заказ');
                    finishBtn.disabled = false;
                    finishBtn.innerHTML = orig;
                }
            });
        }

        // Обработка "Уйти на перерыв"
        const breakBtn = container.querySelector('.btn-request-break');
        if (breakBtn) {
            breakBtn.addEventListener('click', async () => {
                const orig = breakBtn.innerHTML;
                breakBtn.disabled = true;
                breakBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const res = await fetch('http://localhost:5000/employees/break/request', {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || 'Ошибка');
                    }
                    alert('Запрос на перерыв отправлен бригадиру!');
                    breakBtn.innerHTML = orig;
                    breakBtn.disabled = false;
                } catch (err) {
                    alert(err.message);
                    breakBtn.innerHTML = orig;
                    breakBtn.disabled = false;
                }
            });
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить данные</div>';
    }
}

// ─── Вкладка "Управление бригадами" для Старшего менеджера ──────────
async function renderTeamsManagerTab(container) {
    container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Загрузка списка бригад...</div>';
    updateHeader('Управление бригадами', 'Создание и редактирование рабочих команд склада');

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch('http://localhost:5000/teams', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Ошибка при получении бригад');
        const teams = await res.json();

        const html = `
            <div class="orders-toolbar" style="display:flex; justify-content:flex-end;">
                <button class="btn-primary" id="btn-create-team"><i class="fa-solid fa-plus"></i> Добавить бригаду</button>
            </div>
            <div class="employees-list">
                ${teams.length > 0 ? teams.map(t => {
                    const fName = t.foreman ? (t.foreman.firstName + ' ' + t.foreman.lastName).trim() : 'Нет бригадира';
                    const workersList = (t.workers || []).map(w =>
                        `<span style="font-size:12px; background:#f3f4f6; border-radius:4px; padding:2px 8px; margin:2px 2px 0 0; display:inline-block;">${w.firstName} ${w.lastName}</span>`
                    ).join('');
                    return `
                    <div class="employee-card" style="flex-direction:column; align-items:stretch; gap:12px; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <span style="font-size:17px; font-weight:600; color:#1a1a1a;">${t.name}</span>
                                <div style="font-size:13px; color:#6b7280; margin-top:4px;"><i class="fa-solid fa-user-tie"></i> Бригадир: ${fName}</div>
                                <div style="font-size:13px; color:#6b7280;"><i class="fa-solid fa-users"></i> Сборщиков: ${t._count?.workers || 0}</div>
                            </div>
                            <div class="employee-actions">
                                <button class="btn-edit btn-edit-team" data-team-id="${t.id}" data-team-name="${t.name}" data-foreman-id="${t.foremanId}">
                                    <i class="fa-solid fa-pen"></i> Изменить
                                </button>
                                <button class="btn-delete btn-delete-team" data-team-id="${t.id}">
                                    <i class="fa-solid fa-trash"></i> Удалить
                                </button>
                            </div>
                        </div>
                        ${t.workers && t.workers.length > 0 ? `<div style="border-top:1px solid #f3f4f6; padding-top:10px;">${workersList}</div>` : ''}
                    </div>`;
                }).join('') : '<div style="padding: 30px; text-align: center; color: #666;">Пока нет созданных бригад</div>'}
            </div>
        `;
        container.innerHTML = html;

        // Удаление бригады
        container.querySelectorAll('.btn-delete-team').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Удалить бригаду? Все прикреплённые сотрудники станут свободными (не удаляются из системы).')) return;
                const teamId = btn.getAttribute('data-team-id');
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const dRes = await fetch(`http://localhost:5000/teams/${teamId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!dRes.ok) throw new Error();
                    renderTeamsManagerTab(container);
                } catch {
                    alert('Ошибка удаления');
                    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Удалить';
                }
            });
        });

        // Изменение бригады
        container.querySelectorAll('.btn-edit-team').forEach(btn => {
            btn.addEventListener('click', async () => {
                const teamId = btn.getAttribute('data-team-id');
                const teamName = btn.getAttribute('data-team-name');
                const foremanId = parseInt(btn.getAttribute('data-foreman-id'), 10);

                const eRes = await fetch('http://localhost:5000/employees', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!eRes.ok) return alert('Ошибка загрузки сотрудников');
                const employees = await eRes.json();

                showEditTeamModal({
                    team: { id: parseInt(teamId, 10), name: teamName, foremanId },
                    employees,
                    onSave: async (data) => {
                        const pRes = await fetch(`http://localhost:5000/teams/${teamId}`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: data.name, foremanId: data.foremanId })
                        });
                        if (!pRes.ok) {
                            const errBody = await pRes.json().catch(() => ({}));
                            throw new Error(errBody.message || 'Ошибка сохранения');
                        }
                        renderTeamsManagerTab(container);
                    },
                    onAddWorker: async (workerId) => {
                        const pRes = await fetch(`http://localhost:5000/teams/${teamId}/workers`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ workerId: Number(workerId) })
                        });
                        if (!pRes.ok) {
                            const errBody = await pRes.json().catch(() => ({}));
                            throw new Error(errBody.message || 'Ошибка добавления');
                        }
                    },
                    onRemoveWorker: async (workerId) => {
                        const dRes = await fetch(`http://localhost:5000/teams/${teamId}/workers/${workerId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!dRes.ok) {
                            const errBody = await dRes.json().catch(() => ({}));
                            throw new Error(errBody.message || 'Ошибка удаления');
                        }
                    }
                });
            });
        });

        // Создание бригады
        document.getElementById('btn-create-team').addEventListener('click', async () => {
            const eRes = await fetch('http://localhost:5000/employees', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!eRes.ok) return alert('Не удалось загрузить сотрудников');
            const employees = await eRes.json();

            const hasForemen = employees.some(e => e.role && e.role.name === 'foreman');
            if (!hasForemen) return alert('Нет бригадиров в системе. Сначала добавьте сотрудника с ролью Бригадир.');

            showEditTeamModal({
                team: { id: null, name: '', foremanId: null },
                employees,
                onSave: async (data) => {
                    const pRes = await fetch('http://localhost:5000/teams', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: data.name, foremanId: data.foremanId })
                    });
                    if (!pRes.ok) {
                        const errBody = await pRes.json().catch(() => ({}));
                        throw new Error(errBody.message || 'Ошибка создания');
                    }
                    renderTeamsManagerTab(container);
                },
                onAddWorker: null,
                onRemoveWorker: null,
                onClose: null
            });
        });

    } catch (err) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #e53e3e;">Не удалось загрузить бригады</div>';
    }
}


