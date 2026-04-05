/**
 * prisma/seed.ts
 * Сбрасывает и заполняет базу начальными данными для микроменеджмента.
 * Запуск: npx prisma db seed  или автоматически при старте сервера
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем сидирование (полный сброс)...');

  // ─── ОЧИСТКА ДАННЫХ (в порядке зависимостей) ──────────────────
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  // Обнуляем teamId у юзеров перед удалением бригад
  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();
  await prisma.userResponsibility.deleteMany();
  // Удаляем тестовых юзеров
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'manager@tech.com',
          'foreman@tech.com',
          'worker@tech.com',
          'worker2@tech.com',
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
      create: { name: 'worker', description: 'Сотрудник (выполняет заказы)' },
    }),
  ]);

  console.log(`✅ Роли созданы.`);

  // 2. ПОЛЬЗОВАТЕЛИ (все inactive по умолчанию, станут active при логине)
  const managerHash = await bcrypt.hash('manager123', 10);
  const foremanHash = await bcrypt.hash('foreman123', 10);
  const workerHash = await bcrypt.hash('worker123', 10);

  const seniorManager = await prisma.user.create({
    data: {
      email: 'manager@tech.com',
      username: 'manager',
      passwordHash: managerHash,
      firstName: 'Иван',
      lastName: 'Менеджер',
      roleId: seniorManagerRole.id,
      status: 'inactive',
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
    },
  });

  // 3. БРИГАДА
  const teamAlpha = await prisma.team.create({
    data: {
      name: 'Бригада Альфа',
      foremanId: foreman.id,
    },
  });

  // Сотрудники
  const worker1 = await prisma.user.create({
    data: {
      email: 'worker@tech.com',
      username: 'worker',
      passwordHash: workerHash,
      firstName: 'Алексей',
      lastName: 'Сборщик',
      roleId: workerRole.id,
      teamId: teamAlpha.id,
      status: 'inactive',
    },
  });

  const worker2 = await prisma.user.create({
    data: {
      email: 'worker2@tech.com',
      username: 'worker2',
      passwordHash: workerHash,
      firstName: 'Сергей',
      lastName: 'Сборщик',
      roleId: workerRole.id,
      teamId: teamAlpha.id,
      status: 'inactive',
    },
  });

  console.log(`✅ Пользователи и бригада созданы.`);

  // 4. ТОВАРЫ (С ячейками хранения)
  let defaultCategory = await prisma.category.findFirst();
  if (!defaultCategory) {
    defaultCategory = await prisma.category.create({
      data: { name: 'Детали', slug: 'details', imageUrl: 'https://placehold.co/400' },
    });
  }

  const productsData = [
    { sku: 'ITM-01', name: 'Деталь A', price: 100, storageCell: 'Стеллаж 1, Полка А', department: 'Цех 1' },
    { sku: 'ITM-02', name: 'Деталь B', price: 200, storageCell: 'Стеллаж 1, Полка B', department: 'Цех 1' },
    { sku: 'ITM-03', name: 'Деталь C', price: 300, storageCell: 'Стеллаж 2, Полка А', department: 'Цех 2' },
  ];

  const createdProducts = await Promise.all(
    productsData.map((p) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: { storageCell: p.storageCell, department: p.department },
        create: {
          categoryId: defaultCategory!.id,
          name: p.name,
          price: p.price,
          sku: p.sku,
          storageCell: p.storageCell,
          department: p.department,
          stockQuantity: 100,
        },
      }),
    ),
  );

  console.log(`✅ Товары с ячейками загружены.`);

  // 5. ТРИ НЕНАЗНАЧЕННЫХ ЗАКАЗА (новые, без бригады)
  // Создаём "клиента" — будем использовать менеджера как заказчика для теста
  await prisma.order.create({
    data: {
      userId: seniorManager.id,
      deliveryType: 'pickup',
      deliveryAddress: 'Заказ от клиента Иванова',
      status: 'new',
      totalAmount: 300,
      items: {
        create: [
          { productId: createdProducts[0].id, quantity: 1, priceAtMoment: 100 },
          { productId: createdProducts[1].id, quantity: 1, priceAtMoment: 200 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: seniorManager.id,
      deliveryType: 'pickup',
      deliveryAddress: 'Заказ от клиента Петрова',
      status: 'new',
      totalAmount: 500,
      items: {
        create: [
          { productId: createdProducts[1].id, quantity: 1, priceAtMoment: 200 },
          { productId: createdProducts[2].id, quantity: 1, priceAtMoment: 300 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      userId: seniorManager.id,
      deliveryType: 'pickup',
      deliveryAddress: 'Заказ от клиента Сидорова',
      status: 'new',
      totalAmount: 400,
      items: {
        create: [
          { productId: createdProducts[0].id, quantity: 2, priceAtMoment: 100 },
          { productId: createdProducts[2].id, quantity: 1, priceAtMoment: 300 },
        ],
      },
    },
  });

  console.log(`✅ 3 неназначенных заказа созданы.`);
  console.log('🎉 Сидирование завершено!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка сидирования:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());