import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async getDashboard() {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);

        // ─── KPI карточки (параллельные агрегации) ───────────────────────────
        const [
            salesThisWeekRaw,
            salesLastWeekRaw,
            ordersThisWeek,
            ordersLastWeek,
            stockAgg,
            activeClients,
            activeClientsLastMonth,
            lastOrders,
            lowStockProducts,
        ] = await Promise.all([
            // Продажи за текущие 7 дней
            this.prisma.order.aggregate({
                where: { status: { notIn: ['cart', 'cancelled'] }, createdAt: { gte: weekAgo } },
                _sum: { totalAmount: true },
            }),
            // Продажи за предыдущие 7 дней
            this.prisma.order.aggregate({
                where: {
                    status: { notIn: ['cart', 'cancelled'] },
                    createdAt: { gte: twoWeeksAgo, lt: weekAgo },
                },
                _sum: { totalAmount: true },
            }),
            // Кол-во заказов за эту неделю
            this.prisma.order.count({
                where: { status: { notIn: ['cart', 'cancelled'] }, createdAt: { gte: weekAgo } },
            }),
            // Кол-во заказов за прошлую неделю
            this.prisma.order.count({
                where: {
                    status: { notIn: ['cart', 'cancelled'] },
                    createdAt: { gte: twoWeeksAgo, lt: weekAgo },
                },
            }),
            // Суммарный склад
            this.prisma.product.aggregate({
                where: { isActive: true },
                _sum: { stockQuantity: true },
                _count: { _all: true },
            }),
            // Активные клиенты (по роли customer)
            this.prisma.user.count({
                where: { role: { name: 'customer' } },
            }),
            // Клиенты месяц назад (для % роста)
            this.prisma.user.count({
                where: { role: { name: 'customer' }, createdAt: { lt: monthAgo } },
            }),
            // Последние 5 заказов
            this.prisma.order.findMany({
                where: { status: { not: 'cart' } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    user: { select: { firstName: true, lastName: true } },
                    payments: { select: { paymentMethod: true } },
                },
            }),
            // Товары с низкими остатками (≤ 10 шт.)
            this.prisma.product.findMany({
                where: { stockQuantity: { lte: 10 } },
                orderBy: { stockQuantity: 'asc' },
                select: { id: true, name: true, stockQuantity: true, sku: true },
            }),
        ]);

        // ─── Данные для графиков (7 дней по дням) ────────────────────────────
        const charts = await this.buildCharts(weekAgo);

        // ─── Вычисляем % изменений ───────────────────────────────────────────
        const salesThis = Number(salesThisWeekRaw._sum.totalAmount ?? 0);
        const salesLast = Number(salesLastWeekRaw._sum.totalAmount ?? 0);
        const salesGrowthPercent = salesLast > 0
            ? +((salesThis - salesLast) / salesLast * 100).toFixed(1)
            : null;

        const ordersGrowthPercent = ordersLastWeek > 0
            ? +((ordersThisWeek - ordersLastWeek) / ordersLastWeek * 100).toFixed(1)
            : null;

        const clientsGrowthPercent = activeClientsLastMonth > 0
            ? +((activeClients - activeClientsLastMonth) / activeClientsLastMonth * 100).toFixed(1)
            : null;

        return {
            kpi: {
                salesWeekly: salesThis,
                salesGrowthPercent,
                ordersWeekly: ordersThisWeek,
                ordersGrowthPercent,
                totalStock: stockAgg._sum.stockQuantity ?? 0,
                lowStockCount: lowStockProducts.length,
                activeClients,
                clientsGrowthPercent,
            },
            charts,
            lastOrders,
            lowStockProducts,
        };
    }

    // Группировка по дням за последние 7 суток
    private async buildCharts(from: Date) {
        const orders = await this.prisma.order.findMany({
            where: {
                status: { notIn: ['cart', 'cancelled'] },
                createdAt: { gte: from },
            },
            select: {
                createdAt: true,
                totalAmount: true,
            },
        });

        // Генерируем заготовку для каждого из 7 дней
        const days: { date: string; sales: number; ordersCount: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push({
                date: d.toISOString().slice(0, 10), // "YYYY-MM-DD"
                sales: 0,
                ordersCount: 0,
            });
        }

        // Накапливаем данные из заказов
        for (const order of orders) {
            const dayKey = order.createdAt!.toISOString().slice(0, 10);
            const slot = days.find((d) => d.date === dayKey);
            if (slot) {
                slot.sales += Number(order.totalAmount);
                slot.ordersCount += 1;
            }
        }

        return days;
    }
}
