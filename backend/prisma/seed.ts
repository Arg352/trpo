/**
 * prisma/seed.ts
 * Сбрасывает и заполняет базу начальными данными для SmartPicker.
 * Запуск: npx prisma db seed  или автоматически при старте сервера
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем сидирование (полный сброс)...');

  // ─── ОЧИСТКА ДАННЫХ (в порядке зависимостей) ──────────────────
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();
  // Удаляем всех сид-пользователей по username (не зависит от изменений email)
  await prisma.user.deleteMany({
    where: {
      username: {
        in: [
          'manager',
          'foreman', 'foreman2', 'foreman3',
          'worker_a1', 'worker_a2', 'worker_a3',
          'worker_b1', 'worker_b2', 'worker_b3',
          'worker_c1', 'worker_c2', 'worker_c3',
        ],
      },
    },
  });


  console.log('🧹 Старые данные очищены.');

  // 1. РОЛИ
  const [seniorManagerRole, foremanRole, workerRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: 'senior_manager' },
      update: {},
      create: { name: 'senior_manager', description: 'Старший менеджер (распределяет на бригады)' },
    }),
    prisma.role.upsert({
      where: { name: 'foreman' },
      update: {},
      create: { name: 'foreman', description: 'Бригадир (распределяет по работникам)' },
    }),
    prisma.role.upsert({
      where: { name: 'worker' },
      update: {},
      create: { name: 'worker', description: 'Сборщик (выполняет заказы)' },
    }),
  ]);

  console.log(`✅ Роли созданы.`);

  // 2. ПОЛЬЗОВАТЕЛИ
  const managerHash = await bcrypt.hash('manager123', 10);
  const foremanHash = await bcrypt.hash('foreman123', 10);
  const workerHash = await bcrypt.hash('worker123', 10);

  const seniorManager = await prisma.user.create({
    data: {
      email: 'sashapupsik2026@gmail.com',
      username: 'manager',
      passwordHash: managerHash,
      firstName: 'Иван',
      lastName: 'Менеджер',
      roleId: seniorManagerRole.id,
      status: 'inactive',

      breakStatus: 'working',
    },
  });

  const foreman = await prisma.user.create({
    data: {
      email: 'foreman@tech.com',
      username: 'foreman',
      passwordHash: foremanHash,
      firstName: 'Петр',
      lastName: 'Бригадир',
      roleId: foremanRole.id,
      status: 'inactive',
      breakStatus: 'working',
    },
  });

  // 3. ДОПОЛНИТЕЛЬНЫЕ БРИГАДИРЫ
  const foreman2 = await prisma.user.create({
    data: { email: 'foreman2@tech.com', username: 'foreman2', passwordHash: foremanHash, firstName: 'Михаил', lastName: 'Иванов', roleId: foremanRole.id, status: 'inactive', breakStatus: 'working' },
  });
  const foreman3 = await prisma.user.create({
    data: { email: 'foreman3@tech.com', username: 'foreman3', passwordHash: foremanHash, firstName: 'Андрей', lastName: 'Смирнов', roleId: foremanRole.id, status: 'inactive', breakStatus: 'working' },
  });

  // 4. БРИГАДЫ
  const teamAlpha = await prisma.team.create({ data: { name: 'Бригада Альфа (Электроника)', foremanId: foreman.id } });
  const teamBeta = await prisma.team.create({ data: { name: 'Бригада Бета (Бытовая техника)', foremanId: foreman2.id } });
  const teamGamma = await prisma.team.create({ data: { name: 'Бригада Гамма (Аксессуары)', foremanId: foreman3.id } });

  // 5. ДОПОЛНИТЕЛЬНЫЕ СОТРУДНИКИ (по 3 человека в команде)
  const cw = async (email, username, first, last, teamId) =>
    prisma.user.create({
      data: { email, username, passwordHash: workerHash, firstName: first, lastName: last, roleId: workerRole.id, teamId, status: 'inactive', breakStatus: 'working' },
    });

  await cw('worker_a1@tech.com', 'worker_a1', 'Алексей', 'Сборщик', teamAlpha.id);
  await cw('worker_a2@tech.com', 'worker_a2', 'Сергей', 'Сборщик', teamAlpha.id);
  await cw('worker_a3@tech.com', 'worker_a3', 'Виталий', 'Сборщик', teamAlpha.id);

  await cw('worker_b1@tech.com', 'worker_b1', 'Егор', 'Новиков', teamBeta.id);
  await cw('worker_b2@tech.com', 'worker_b2', 'Илья', 'Сидоров', teamBeta.id);
  await cw('worker_b3@tech.com', 'worker_b3', 'Дмитрий', 'Морозов', teamBeta.id);

  await cw('worker_c1@tech.com', 'worker_c1', 'Максим', 'Попов', teamGamma.id);
  await cw('worker_c2@tech.com', 'worker_c2', 'Олег', 'Кузнецов', teamGamma.id);
  await cw('worker_c3@tech.com', 'worker_c3', 'Григорий', 'Васильев', teamGamma.id);

  console.log(`✅ Пользователи и 3 бригады по 3 человека (и 1 бригадир) созданы.`);

  // 6. ТОВАРЫ (С ячейками хранения)
  const catElec = await prisma.category.upsert({ where: { slug: 'electronics' }, update: {}, create: { name: 'Электроника', slug: 'electronics' } });
  const catAccess = await prisma.category.upsert({ where: { slug: 'accessories' }, update: {}, create: { name: 'Аксессуары', slug: 'accessories' } });

  const productsData = [
    { sku: 'LAP-MAC-M2', categoryId: catElec.id, name: 'Apple MacBook Air 13" M2, 8/256GB', price: 110000, storageCell: 'A-12-01', department: 'Зона ценных грузов' },
    { sku: 'PHN-IP14-128', categoryId: catElec.id, name: 'Apple iPhone 14 128GB Midnight', price: 85000, storageCell: 'A-15-04', department: 'Зона ценных грузов' },
    { sku: 'CON-PS5-DS5', categoryId: catElec.id, name: 'Sony PlayStation 5 (с дисководом)', price: 55000, storageCell: 'B-02-12', department: 'Зона крупногабарита' },
    { sku: 'ACC-AIRP-PRO2', categoryId: catAccess.id, name: 'Apple AirPods Pro 2', price: 23000, storageCell: 'C-05-01', department: 'Мелкая электроника' },
    { sku: 'ACC-LOGI-MX', categoryId: catAccess.id, name: 'Мышь Logitech MX Master 3S', price: 10500, storageCell: 'C-08-11', department: 'Мелкая электроника' },
    { sku: 'WTC-APP-S8', categoryId: catElec.id, name: 'Apple Watch Series 8 45mm', price: 38000, storageCell: 'C-01-09', department: 'Мелкая электроника' },
    { sku: 'CBL-USB-C', categoryId: catAccess.id, name: 'Кабель Ugreen USB-C to USB-C 100W 2м', price: 900, storageCell: 'D-22-15', department: 'Мелкие комплектующие' },
    { sku: 'MON-DELL-U27', categoryId: catElec.id, name: 'Монитор Dell UltraSharp 27" 4K', price: 42000, storageCell: 'B-10-02', department: 'Зона крупногабарита' },
    { sku: 'HDD-WD-4TB', categoryId: catElec.id, name: 'Жёсткий диск WD Red Plus 4TB', price: 12000, storageCell: 'D-05-08', department: 'Мелкие комплектующие' },
    { sku: 'KBD-APPLE-MAGIC', categoryId: catAccess.id, name: 'Apple Magic Keyboard с Touch ID (RU)', price: 13500, storageCell: 'C-11-03', department: 'Мелкая электроника' },
  ];

  const P: Record<string, any> = {};
  for (const p of productsData) {
    P[p.sku] = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { storageCell: p.storageCell, department: p.department },
      create: { categoryId: p.categoryId, name: p.name, price: p.price, sku: p.sku, storageCell: p.storageCell, department: p.department, stockQuantity: 50 },
    });
  }

  console.log(`✅ Товары загружены.`);

  // 7. ЗАКАЗЫ — 14 штук разных статусов и составов
  const mkOrder = (total, status, items, assignedTeamId?) =>
    prisma.order.create({
      data: {
        userId: seniorManager.id, status, totalAmount: total,
        assignedTeamId: assignedTeamId || null,
        items: { create: items.map(([sku, qty]) => ({ productId: P[sku].id, quantity: qty })) },
      },
    });


  // Новые (не назначенные)
  await mkOrder(110900, 'new', [['LAP-MAC-M2', 1], ['CBL-USB-C', 1]]);
  await mkOrder(108000, 'new', [['PHN-IP14-128', 1], ['ACC-AIRP-PRO2', 1]]);
  await mkOrder(55900, 'new', [['CON-PS5-DS5', 1], ['ACC-LOGI-MX', 1]]);
  await mkOrder(52700, 'new', [['WTC-APP-S8', 1], ['ACC-AIRP-PRO2', 1], ['CBL-USB-C', 1]]);
  await mkOrder(42000, 'new', [['MON-DELL-U27', 1]]);

  // Назначены на бригаду Альфа — в работе
  await mkOrder(85000, 'in_progress', [['PHN-IP14-128', 1]], teamAlpha.id);
  await mkOrder(51800, 'in_progress', [['WTC-APP-S8', 1], ['ACC-LOGI-MX', 1], ['KBD-APPLE-MAGIC', 1]], teamAlpha.id);

  // Назначены на бригаду Бета — в работе
  await mkOrder(55000, 'in_progress', [['CON-PS5-DS5', 1]], teamBeta.id);
  await mkOrder(24900, 'in_progress', [['HDD-WD-4TB', 1], ['CBL-USB-C', 3], ['ACC-LOGI-MX', 1]], teamBeta.id);

  // Назначены на бригаду Гамма
  await mkOrder(27300, 'in_progress', [['KBD-APPLE-MAGIC', 1], ['ACC-AIRP-PRO2', 1]], teamGamma.id);

  // Завершённые
  await mkOrder(110000, 'packed', [['LAP-MAC-M2', 1]], teamAlpha.id);
  await mkOrder(13500, 'packed', [['KBD-APPLE-MAGIC', 1]], teamBeta.id);
  await mkOrder(96000, 'delivered', [['PHN-IP14-128', 1], ['WTC-APP-S8', 1]], teamGamma.id);
  await mkOrder(42900, 'delivered', [['MON-DELL-U27', 1], ['CBL-USB-C', 1]], teamAlpha.id);

  console.log(`✅ 14 реалистичных заказов созданы.`);
  console.log('🎉 Сидирование завершено!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка сидирования:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());