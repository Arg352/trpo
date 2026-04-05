import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BuyNowDto } from './dto/buy-now.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VerifyPickupDto } from './dto/verify-pickup.dto';

// Генерация случайного кода выдачи: 10 символов (A-Z, 0-9)
function generatePickupCode(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, price: true, sku: true },
            },
        },
    },
} as const;

// Расширенный include для админки
const ADMIN_ORDER_INCLUDE = {
    user: {
        select: {
            firstName: true,
            lastName: true,
            email: true,   // для модалки "Детали заказа"
            phone: true,   // для модалки "Детали заказа"
        },
    },
    payments: {
        select: { paymentMethod: true },
    },
    items: {
        include: {
            product: {
                select: { id: true, name: true, price: true, sku: true, storageCell: true, department: true },
            },
        },
    },
} as const;

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    // Получить все заказы пользователя (кроме корзины)
    async getMyOrders(userId: number) {
        return this.prisma.order.findMany({
            where: { userId, status: { not: 'cart' } },
            include: ORDER_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    // Получить один заказ (с проверкой принадлежности)
    async getOrder(userId: number, orderId: number) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
            include: ORDER_INCLUDE,
        });

        if (!order) {
            throw new NotFoundException(`Заказ #${orderId} не найден`);
        }

        return order;
    }

    // Все заказы для админки (с поиском и фильтром по статусу)
    async getAllOrders(search?: string, status?: string) {
        const where: any = { status: { not: 'cart' } };

        if (status) {
            where.status = status;
        }

        if (search) {
            const orderId = parseInt(search, 10);
            where.OR = [
                // Поиск по ID заказа
                ...(!isNaN(orderId) ? [{ id: orderId }] : []),
                // Поиск по имени/фамилии клиента
                { user: { firstName: { contains: search } } },
                { user: { lastName: { contains: search } } },
            ];
        }

        return this.prisma.order.findMany({
            where,
            include: ADMIN_ORDER_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    // Один заказ для админки (без проверки on userId)
    async getAdminOrder(orderId: number) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: ADMIN_ORDER_INCLUDE,
        });
        if (!order) {
            throw new NotFoundException(`Заказ #${orderId} не найден`);
        }
        return order;
    }

    // Изменение статуса заказа (с возвратом на склад при отмене)
    async updateStatus(orderId: number, dto: UpdateOrderStatusDto) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new NotFoundException(`Заказ #${orderId} не найден`);
        }

        // ОТМЕНА: возвращаем товары на склад через транзакцию
        if (dto.status === 'cancelled' && order.status !== 'cancelled') {
            return this.prisma.$transaction(async (tx) => {
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQuantity: { increment: item.quantity } },
                    });
                }

                return tx.order.update({
                    where: { id: orderId },
                    data: { status: 'cancelled' },
                    include: ADMIN_ORDER_INCLUDE,
                });
            });
        }

        // Обычная смена статуса (не отмена)
        return this.prisma.order.update({
            where: { id: orderId },
            data: { status: dto.status },
            include: ADMIN_ORDER_INCLUDE,
        });
    }

    // Получить код выдачи (для покупателя)
    async getPickupCode(userId: number, orderId: number) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
            select: { status: true, pickupCode: true },
        });

        if (!order) {
            throw new NotFoundException(`Заказ #${orderId} не найден`);
        }

        if (order.status !== 'shipped') {
            throw new BadRequestException(
                'Код выдачи пока недоступен. Заказ должен иметь статус "shipped"',
            );
        }

        return { pickupCode: order.pickupCode };
    }

    // Верификация кода выдачи (для сотрудника)
    async verifyPickup(dto: VerifyPickupDto) {
        const order = await this.prisma.order.findUnique({
            where: { id: dto.orderId },
            select: { id: true, pickupCode: true, status: true },
        });

        if (!order) {
            throw new NotFoundException(`Заказ #${dto.orderId} не найден`);
        }

        if (order.pickupCode !== dto.code) {
            throw new BadRequestException('Неверный код выдачи');
        }

        await this.prisma.order.update({
            where: { id: dto.orderId },
            data: { status: 'delivered' },
        });

        return {
            success: true,
            message: 'Код верный, заказ выдан!',
        };
    }

    // Купить сейчас (в обход корзины)
    async buyNow(userId: number, dto: BuyNowDto) {
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
        });

        if (!product || product.stockQuantity < dto.quantity) {
            throw new BadRequestException(
                'Товар недоступен или недостаточно на складе',
            );
        }

        const totalAmount = Number(product.price) * dto.quantity;
        const pickupCode = generatePickupCode();

        const order = await this.prisma.$transaction(async (tx) => {
            // Создаём заказ
            const newOrder = await tx.order.create({
                data: {
                    userId,
                    deliveryType: dto.deliveryType,
                    deliveryAddress: dto.deliveryAddress,
                    status: 'new',
                    totalAmount,
                    pickupCode,
                },
            });

            // Создаём позицию заказа
            await tx.orderItem.create({
                data: {
                    orderId: newOrder.id,
                    productId: dto.productId,
                    quantity: dto.quantity,
                    priceAtMoment: product.price,
                },
            });

            // Списываем со склада
            await tx.product.update({
                where: { id: dto.productId },
                data: { stockQuantity: { decrement: dto.quantity } },
            });

            // Возвращаем заказ с items
            return tx.order.findUnique({
                where: { id: newOrder.id },
                include: ORDER_INCLUDE,
            });
        });

        return {
            message: 'Заказ успешно создан!',
            order,
        };
    }

    // Оформление заказа
    async checkout(userId: number, dto: CheckoutDto) {
        // 1. Находим активную корзину со всеми товарами
        const cart = await this.prisma.order.findFirst({
            where: { userId, status: 'cart' },
            include: {
                items: {
                    include: { product: true },
                },
            },
        });

        if (!cart) {
            throw new NotFoundException('Активная корзина не найдена');
        }
        if (cart.items.length === 0) {
            throw new BadRequestException('Нельзя оформить пустую корзину');
        }

        // 2. Атомарная транзакция: проверяем склад и списываем
        return this.prisma.$transaction(async (tx) => {
            for (const item of cart.items) {
                const freshProduct = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { id: true, name: true, stockQuantity: true },
                });

                if (!freshProduct) {
                    throw new BadRequestException(
                        `Товар в корзине больше не существует`,
                    );
                }

                if (freshProduct.stockQuantity < item.quantity) {
                    throw new BadRequestException(
                        `Товар "${freshProduct.name}" закончился на складе. ` +
                        `Запрошено: ${item.quantity} шт., доступно: ${freshProduct.stockQuantity} шт.`,
                    );
                }

                // Списываем со склада
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { decrement: item.quantity } },
                });

                // Фиксируем актуальную цену в момент покупки
                await tx.orderItem.update({
                    where: { id: item.id },
                    data: { priceAtMoment: item.product.price },
                });
            }

            // 3. Превращаем корзину в реальный заказ (статус: new) + генерируем код выдачи
            const finalOrder = await tx.order.update({
                where: { id: cart.id },
                data: {
                    status: 'new',
                    deliveryType: dto.deliveryType,
                    deliveryAddress: dto.deliveryAddress,
                    deliveryDateFrom: dto.deliveryDateFrom ? new Date(dto.deliveryDateFrom) : null,
                    deliveryDateTo: dto.deliveryDateTo ? new Date(dto.deliveryDateTo) : null,
                    deliveryTimeSlot: dto.deliveryTimeSlot ?? null,
                    pickupCode: generatePickupCode(),
                    createdAt: new Date(),
                },
                include: ORDER_INCLUDE,
            });

            return {
                message: 'Заказ успешно оформлен!',
                order: finalOrder,
            };
        });
    }

    // Заказы для старшего менеджера: новые и в обработке
    async getManagerOrders() {
        const orders = await this.prisma.order.findMany({
            where: {
                status: { in: ['new', 'processing'] },
            },
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedTeam: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Сортируем: сначала нераспределённые (новые), потом в обработке
        return orders.sort((a, b) => {
            const priority = { 'new': 0, 'processing': 1 };
            const pa = priority[a.status as keyof typeof priority] ?? 2;
            const pb = priority[b.status as keyof typeof priority] ?? 2;
            return pa - pb;
        });
    }

    // Список бригад
    async getTeams() {
        return this.prisma.team.findMany({
            select: {
                id: true,
                name: true,
                foreman: { select: { firstName: true, lastName: true } },
                _count: { select: { workers: true } },
            },
        });
    }

    // Назначить бригаду на заказ
    async assignTeam(orderId: number, teamId: number) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);

        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                assignedTeamId: teamId,
                status: 'processing',
            },
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedTeam: { select: { id: true, name: true } },
            },
        });
    }

    // Снять бригаду с заказа (менеджер)
    async unassignTeam(orderId: number) {
        // Сбрасываем заказ в статус 'new', убираем бригаду и работника, сбрасываем упаковку
        return this.prisma.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: { orderId },
                data: { isPacked: false },
            });

            return tx.order.update({
                where: { id: orderId },
                data: {
                    assignedTeamId: null,
                    assignedWorkerId: null,
                    workerQueueStatus: null,
                    status: 'new',
                },
                include: ADMIN_ORDER_INCLUDE,
            });
        });
    }

    // ─── БРИГАДИР ─────────────────────────────────────────────────────

    // Заказы бригады бригадира (назначенные менеджером, не выполненные)
    async getForemanOrders(foremanUserId: number) {
        // Находим бригаду, где этот юзер — бригадир
        const team = await this.prisma.team.findFirst({
            where: { foremanId: foremanUserId },
        });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const orders = await this.prisma.order.findMany({
            where: {
                assignedTeamId: team.id,
                status: { in: ['processing', 'shipped'] },
            },
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedWorker: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Сортируем: сначала без работника, потом назначенные
        return orders.sort((a, b) => {
            const pa = a.assignedWorkerId ? 1 : 0;
            const pb = b.assignedWorkerId ? 1 : 0;
            return pa - pb;
        });
    }

    // Назначить работника на заказ (бригадир)
    async assignWorker(foremanUserId: number, orderId: number, workerId: number) {
        const team = await this.prisma.team.findFirst({
            where: { foremanId: foremanUserId },
        });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);
        if (order.assignedTeamId !== team.id) {
            throw new ForbiddenException('Этот заказ не принадлежит вашей бригаде');
        }

        // Проверяем что работник в бригаде
        const worker = await this.prisma.user.findFirst({
            where: { id: workerId, teamId: team.id },
        });
        if (!worker) throw new NotFoundException('Работник не найден в вашей бригаде');

        // Проверяем лимит заказов у работника (бизнес-правило: макс 2 заказа)
        const activeOrdersCount = await this.prisma.order.count({
            where: {
                assignedWorkerId: workerId,
                status: { in: ['processing', 'shipped'] },
            },
        });

        if (activeOrdersCount >= 2) {
            throw new BadRequestException('У сотрудника уже максимально возможное количество заказов (2)');
        }

        // Определяем статус в очереди: если 0 - 'active', если 1 - 'queued'
        const queueStatus = activeOrdersCount === 0 ? 'active' : 'queued';

        return this.prisma.order.update({
            where: { id: orderId },
            data: { 
                assignedWorkerId: workerId,
                workerQueueStatus: queueStatus,
            },
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedWorker: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    // Снять работника с заказа (бригадир)
    async unassignWorker(orderId: number) {
        return this.prisma.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: { orderId },
                data: { isPacked: false },
            });

            return tx.order.update({
                where: { id: orderId },
                data: {
                    assignedWorkerId: null,
                    workerQueueStatus: null,
                },
                include: ADMIN_ORDER_INCLUDE,
            });
        });
    }

    // Пометить товар как упакованный (работник)
    async packItem(itemId: number, packed: boolean) {
        return this.prisma.orderItem.update({
            where: { id: itemId },
            data: { isPacked: packed },
            include: {
                product: true,
                order: {
                    include: {
                        items: true,
                    },
                },
            },
        });
    }

    // Список сотрудников бригады (для бригадира)
    async getTeamMembers(foremanUserId: number) {
        const team = await this.prisma.team.findFirst({
            where: { foremanId: foremanUserId },
            select: { id: true, name: true },
        });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const workers = await this.prisma.user.findMany({
            where: { teamId: team.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                username: true,
                status: true,
                role: { select: { name: true } },
                _count: {
                    select: {
                        workerOrders: {
                            where: { status: { in: ['processing', 'shipped'] } },
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
        });

        return {
            teamName: team.name,
            members: workers.map(w => ({
                id: w.id,
                firstName: w.firstName,
                lastName: w.lastName,
                email: w.email,
                phone: w.phone,
                username: w.username,
                status: w.status,
                roleName: w.role.name,
                activeOrdersCount: w._count.workerOrders,
            })),
        };
    }

    // Заказы конкретного сотрудника (для сборки)
    async getWorkerOrders(workerId: number) {
        return this.prisma.order.findMany({
            where: {
                assignedWorkerId: workerId,
                status: { in: ['processing', 'shipped'] },
            },
            include: ADMIN_ORDER_INCLUDE,
            orderBy: { workerQueueStatus: 'asc' }, // 'active' first, then 'queued'
        });
    }
}

