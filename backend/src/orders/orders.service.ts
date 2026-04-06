import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, price: true, sku: true, storageCell: true, department: true },
            },
        },
    },
} as const;

const ADMIN_ORDER_INCLUDE = {
    user: {
        select: {
            firstName: true,
            lastName: true,
            email: true,
        },
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

    // --- СТАРШИЙ МЕНЕДЖЕР ---
    async getManagerOrders() {
        const orders = await this.prisma.order.findMany({
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedTeam: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Сортировка:
        // 0. Не назначена бригада (самые важные)
        // 1. В обработке/В работе
        // 2. Завершенные (packed, delivered, etc.)
        return orders.sort((a, b) => {
            const getPriority = (o: any) => {
                if (!o.assignedTeamId) return 0;
                const completedStatuses = ['packed', 'ready', 'delivered', 'shipped'];
                if (completedStatuses.includes(o.status)) return 2;
                return 1;
            };

            const pa = getPriority(a);
            const pb = getPriority(b);
            
            if (pa !== pb) return pa - pb;
            
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    }

    // Список доступных бригад
    async getTeams() {
        return this.prisma.team.findMany({
            select: {
                id: true,
                name: true,
                foreman: { select: { firstName: true, lastName: true } },
                _count: { select: { workers: true, orders: { where: { status: { notIn: ['packed', 'ready', 'delivered'] } } } } },
            },
        });
    }

    // Назначить заказ на бригаду
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

    // Снять бригаду с заказа
    async unassignTeam(orderId: number) {
        return this.prisma.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: { orderId },
                data: { isPacked: false, packedAt: null },
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

    // --- БРИГАДИР ---
    async getForemanOrders(foremanUserId: number) {
        const team = await this.prisma.team.findFirst({
            where: { foremanId: foremanUserId },
        });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const orders = await this.prisma.order.findMany({
            where: {
                assignedTeamId: team.id,
                status: { in: ['processing', 'in_progress'] },
            },
            include: {
                ...ADMIN_ORDER_INCLUDE,
                assignedWorker: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Сортировка для бригадира: сначала те, кто без рабочего
        return orders.sort((a, b) => {
            const pa = a.assignedWorkerId ? 1 : 0;
            const pb = b.assignedWorkerId ? 1 : 0;
            if (pa !== pb) return pa - pb;
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    }

    // Список сотрудников текущей бригады
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
                username: true,
                status: true,
                breakStatus: true,
                role: { select: { name: true } },
                _count: {
                    select: {
                        workerOrders: {
                            where: { status: { in: ['processing', 'in_progress'] } },
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
                username: w.username,
                status: w.status,
                breakStatus: w.breakStatus,
                roleName: w.role.name,
                activeOrdersCount: w._count.workerOrders,
            })),
        };
    }

    // Назначить работника на заказ
    async assignWorker(foremanUserId: number, orderId: number, workerId: number) {
        const team = await this.prisma.team.findFirst({
            where: { foremanId: foremanUserId },
        });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);
        if (order.assignedTeamId !== team.id) {
            throw new ForbiddenException('Заказ не принадлежит вашей бригаде');
        }

        const worker = await this.prisma.user.findFirst({
            where: { id: workerId, teamId: team.id },
        });
        if (!worker) throw new NotFoundException('Работник не найден в вашей бригаде');
        if (worker.breakStatus && worker.breakStatus !== 'working') throw new BadRequestException('Сотрудник находится на перерыве');

        const activeOrdersCount = await this.prisma.order.count({
            where: {
                assignedWorkerId: workerId,
                status: { in: ['processing', 'in_progress'] },
            },
        });

        if (activeOrdersCount >= 2) {
            throw new BadRequestException('У сотрудника уже максимально возможное количество заказов (2)');
        }

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

    // Снять сотрудника с заказа
    async unassignWorker(orderId: number) {
        return this.prisma.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: { orderId },
                data: { isPacked: false, packedAt: null },
            });

            const order = await tx.order.findUnique({ where: { id: orderId } });
            const workerId = order?.assignedWorkerId;

            const res = await tx.order.update({
                where: { id: orderId },
                data: {
                    assignedWorkerId: null,
                    workerQueueStatus: null,
                },
                include: ADMIN_ORDER_INCLUDE,
            });

            if (workerId) {
                const nextOrder = await tx.order.findFirst({
                    where: { assignedWorkerId: workerId, workerQueueStatus: 'queued' },
                    orderBy: { createdAt: 'asc' },
                });
                if (nextOrder) {
                    await tx.order.update({
                        where: { id: nextOrder.id },
                        data: { workerQueueStatus: 'active' },
                    });
                }
            }

            return res;
        });
    }

    // --- СБОРЩИК ---
    async getWorkerOrders(workerId: number) {
        return this.prisma.order.findMany({
            where: {
                assignedWorkerId: workerId,
                status: { in: ['processing', 'in_progress'] },
            },
            include: ADMIN_ORDER_INCLUDE,
            orderBy: { workerQueueStatus: 'asc' }, // 'active' first, then 'queued'
        });
    }

    // Пометить товар как упакованный
    async packItem(itemId: number, dto: { packed: boolean, hasError?: boolean }) {
        const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
        if (!item) throw new NotFoundException('Позиция не найдена');

        const data: any = { isPacked: dto.packed };
        if (dto.packed && !item.isPacked) {
            data.packedAt = new Date();
        } else if (!dto.packed) {
            data.packedAt = null;
        }

        if (dto.hasError !== undefined) {
            data.hasError = dto.hasError;
        }

        return this.prisma.orderItem.update({
            where: { id: itemId },
            data,
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

    // Завершить сборку
    async finishPicking(workerId: number, orderId: number) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, assignedWorkerId: workerId },
            include: { items: true },
        });

        if (!order) throw new NotFoundException('Заказ не найден в ваших активных');

        const allPacked = order.items.every(i => i.isPacked);
        if (!allPacked) {
            throw new BadRequestException('Не все товары упакованы');
        }

        const hasAnyError = order.items.some(i => i.hasError);
        const finalStatus = hasAnyError ? 'problem' : 'packed';

        const result = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: finalStatus, workerQueueStatus: null },
        });

        const worker = await this.prisma.user.findUnique({ where: { id: workerId } });

        if (worker && worker.breakStatus === 'break_approved') {
            // Уход на перерыв: отвязываем заказы в очереди
            const queuedOrders = await this.prisma.order.findMany({
                where: { assignedWorkerId: workerId, workerQueueStatus: 'queued' }
            });
            for (const qo of queuedOrders) {
                await this.prisma.$transaction([
                    this.prisma.orderItem.updateMany({
                        where: { orderId: qo.id },
                        data: { isPacked: false, packedAt: null },
                    }),
                    this.prisma.order.update({
                        where: { id: qo.id },
                        data: { assignedWorkerId: null, workerQueueStatus: null },
                    })
                ]);
            }
            // Переключаем статус на on_break
            await this.prisma.user.update({
                where: { id: workerId },
                data: { breakStatus: 'on_break', breakApprovedById: null },
            });
        } else {
            // Если не на перерыв, делаем следующий заказ активным (если есть)
            const nextOrder = await this.prisma.order.findFirst({
                where: { assignedWorkerId: workerId, workerQueueStatus: 'queued' },
                orderBy: { createdAt: 'asc' },
            });
            if (nextOrder) {
                await this.prisma.order.update({
                    where: { id: nextOrder.id },
                    data: { workerQueueStatus: 'active' },
                });
            }
        }

        return result;
    }

    // --- АНАЛИТИКА / KPI ---
    async getKPIs() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Line Items: сколько items были упакованы сегодня
        const lineItemsPackedToday = await this.prisma.orderItem.count({
            where: {
                isPacked: true,
                packedAt: {
                    gte: startOfDay,
                },
            },
        });

        // Часы с начала дня (может быть и рабочая смена, здесь упрощенно с начала суток)
        const hoursPassed = (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60) || 1;
        const lineItemsPerHour = Math.round((lineItemsPackedToday / hoursPassed) * 10) / 10;

        // Error Rate: доля позиций с ошибками среди собираемых сегодня
        const errorsToday = await this.prisma.orderItem.count({
            where: {
                hasError: true,
                order: {
                    createdAt: {
                        gte: startOfDay,
                    }
                }
            },
        });

        const allItemsToday = await this.prisma.orderItem.count({
            where: {
                order: {
                    createdAt: {
                        gte: startOfDay,
                    }
                }
            },
        });

        const errorRate = allItemsToday > 0 
            ? Math.round((errorsToday / allItemsToday) * 100 * 10) / 10 
            : 0;

        return {
            lineItemsPerHour,
            errorRate,
            totalLineItemsToday: lineItemsPackedToday,
            totalErrorsToday: errorsToday,
        };
    }
}
