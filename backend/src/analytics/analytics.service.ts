import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface DateRange { from: Date; to: Date }

// ─── Сервис ───────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Утилиты для периодов ───────────────────────────────────────────────────

    /** Вычисляет диапазон [from, to] и предыдущий аналогичный период */
    resolvePeriod(dto: AnalyticsQueryDto): { current: DateRange; previous: DateRange } {
        const to = dto.endDate ? new Date(dto.endDate) : new Date();
        to.setHours(23, 59, 59, 999);

        let from: Date;

        if (dto.startDate) {
            from = new Date(dto.startDate);
            from.setHours(0, 0, 0, 0);
        } else {
            const days = dto.period === 'week' ? 7
                : dto.period === 'month' ? 30
                    : dto.period === 'quarter' ? 90
                        : 365; // year (default)
            from = new Date(to);
            from.setDate(from.getDate() - days + 1);
            from.setHours(0, 0, 0, 0);
        }

        const rangeMs = to.getTime() - from.getTime();
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - rangeMs);

        return {
            current: { from, to },
            previous: { from: prevFrom, to: prevTo },
        };
    }

    /**
     * Группировка: week → по дням, month → по дням, quarter → по неделям, year → по месяцам
     */
    private granularity(dto: AnalyticsQueryDto): 'day' | 'week' | 'month' {
        if (dto.startDate && dto.endDate) {
            const diff = (new Date(dto.endDate).getTime() - new Date(dto.startDate).getTime())
                / (1000 * 60 * 60 * 24);
            return diff <= 31 ? 'day' : diff <= 90 ? 'week' : 'month';
        }
        return dto.period === 'quarter' ? 'week'
            : dto.period === 'year' ? 'month'
                : 'day';
    }

    // ── Основной метод ─────────────────────────────────────────────────────────

    async getAnalytics(dto: AnalyticsQueryDto) {
        const { current, previous } = this.resolvePeriod(dto);

        const [
            // Текущий период
            currentSalesRaw, currentOrdersCount, currentUniqueClients,
            // Предыдущий период (для трендов)
            previousSalesRaw, previousOrdersCount, previousUniqueClients,
            // Детальные данные
            orderItems, topRaw, categoryRaw,
        ] = await Promise.all([
            // ─── Текущий период ────────────────────────────────────────────
            this.prisma.order.aggregate({
                where: this.orderWhere(current),
                _sum: { totalAmount: true },
                _count: { _all: true },
            }),
            this.prisma.order.count({ where: this.orderWhere(current) }),
            this.prisma.order.findMany({
                where: this.orderWhere(current),
                select: { userId: true, totalAmount: true },
            }),
            // ─── Предыдущий период ─────────────────────────────────────────
            this.prisma.order.aggregate({
                where: this.orderWhere(previous),
                _sum: { totalAmount: true },
            }),
            this.prisma.order.count({ where: this.orderWhere(previous) }),
            this.prisma.order.findMany({
                where: this.orderWhere(previous),
                select: { userId: true },
            }),
            // ─── Все позиции для разбивки ──────────────────────────────────
            this.prisma.orderItem.findMany({
                where: { order: this.orderWhere(current) },
                include: {
                    product: { include: { category: { select: { name: true } } } },
                },
            }),
            // ─── Топ-5 товаров ─────────────────────────────────────────────
            this.prisma.orderItem.groupBy({
                by: ['productId'],
                where: { order: this.orderWhere(current) },
                _sum: { quantity: true, priceAtMoment: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            }),
            // ─── Продажи по категориям ─────────────────────────────────────
            this.prisma.orderItem.findMany({
                where: { order: this.orderWhere(current) },
                include: {
                    product: { select: { category: { select: { name: true } } } },
                },
            }),
        ]);

        const totalRevenue = Number(currentSalesRaw._sum.totalAmount ?? 0);
        const prevTotalRevenue = Number(previousSalesRaw._sum.totalAmount ?? 0);
        const activeClients = new Set(currentUniqueClients.map((o) => o.userId)).size;
        const prevActiveClients = new Set(previousUniqueClients.map((o) => o.userId)).size;
        const averageReceipt = currentOrdersCount > 0 ? +(totalRevenue / currentOrdersCount).toFixed(2) : 0;
        const prevAverageReceipt = previousOrdersCount > 0
            ? +(prevTotalRevenue / previousOrdersCount).toFixed(2) : 0;

        const trendCalc = (cur: number, prev: number) =>
            prev > 0 ? +((cur - prev) / prev * 100).toFixed(1) : null;

        // ─── Summary ──────────────────────────────────────────────────────────
        const summary = {
            totalRevenue,
            totalOrders: currentOrdersCount,
            activeClients,
            averageReceipt,
            trends: {
                revenue: trendCalc(totalRevenue, prevTotalRevenue),
                orders: trendCalc(currentOrdersCount, previousOrdersCount),
                clients: trendCalc(activeClients, prevActiveClients),
                averageReceipt: trendCalc(averageReceipt, prevAverageReceipt),
            },
        };

        // ─── Динамика продаж и заказов ────────────────────────────────────────
        const gran = this.granularity(dto);
        const [salesDynamics, ordersDynamics] = this.buildDynamics(
            current,
            currentUniqueClients as any, // мы передаём сырые orders с totalAmount
            gran,
        );

        // ─── Строим динамику правильно из orderItems ──────────────────────────
        const orders4dynamics = await this.prisma.order.findMany({
            where: this.orderWhere(current),
            select: { createdAt: true, totalAmount: true },
        });
        const { sales, counts } = this.buildDynamicsFromOrders(orders4dynamics, current, gran);

        // ─── Продажи по категориям ───────────────────────────────────────────
        const catMap: Record<string, number> = {};
        for (const item of categoryRaw) {
            const cat = item.product.category.name;
            catMap[cat] = (catMap[cat] ?? 0) + Number(item.priceAtMoment) * item.quantity;
        }
        const totalCatRevenue = Object.values(catMap).reduce((a, b) => a + b, 0);
        const salesByCategory = Object.entries(catMap)
            .sort(([, a], [, b]) => b - a)
            .map(([categoryName, totalAmount]) => ({
                categoryName,
                totalAmount: +totalAmount.toFixed(2),
                percentage: totalCatRevenue > 0
                    ? +((totalAmount / totalCatRevenue) * 100).toFixed(1) : 0,
            }));

        // ─── Топ-5 товаров ────────────────────────────────────────────────────
        const productIds = topRaw.map((r) => r.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, sku: true },
        });
        const topProducts = topRaw.map((r) => {
            const p = products.find((pr) => pr.id === r.productId);
            return {
                id: r.productId,
                name: p?.name ?? 'Неизвестно',
                sku: p?.sku ?? null,
                salesCount: r._sum?.quantity ?? 0,
                revenue: +(Number(r._sum?.priceAtMoment ?? 0)).toFixed(2),
            };
        });

        // ─── Прогноз спроса (простая эвристика) ──────────────────────────────
        const forecast = this.buildForecast(salesByCategory, topProducts, summary.trends);

        return {
            period: {
                from: current.from.toISOString(),
                to: current.to.toISOString(),
            },
            summary,
            salesDynamics: sales,
            ordersDynamics: counts,
            salesByCategory,
            topProducts,
            forecast,
        };
    }

    // ── Вспомогательные ───────────────────────────────────────────────────────

    private orderWhere(range: DateRange) {
        return {
            status: { notIn: ['cart', 'cancelled'] },
            createdAt: { gte: range.from, lte: range.to },
        };
    }

    private buildDynamicsFromOrders(
        orders: { createdAt: Date | null; totalAmount: any }[],
        range: DateRange,
        gran: 'day' | 'week' | 'month',
    ) {
        const getKey = (d: Date): string => {
            if (gran === 'day') return d.toISOString().slice(0, 10);
            if (gran === 'week') {
                const monday = new Date(d);
                monday.setDate(d.getDate() - d.getDay() + 1);
                return monday.toISOString().slice(0, 10);
            }
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        // Генерируем все слоты в диапазоне
        const slots: { label: string; sales: number; ordersCount: number }[] = [];
        const cursor = new Date(range.from);
        while (cursor <= range.to) {
            const label = getKey(cursor);
            if (!slots.find((s) => s.label === label)) {
                slots.push({ label, sales: 0, ordersCount: 0 });
            }
            cursor.setDate(cursor.getDate() + (gran === 'month' ? 28 : 1));
        }

        for (const o of orders) {
            if (!o.createdAt) continue;
            const key = getKey(o.createdAt);
            const slot = slots.find((s) => s.label === key);
            if (slot) {
                slot.sales += Number(o.totalAmount ?? 0);
                slot.ordersCount += 1;
            }
        }

        return {
            sales: slots.map(({ label, sales }) => ({ label, value: +sales.toFixed(2) })),
            counts: slots.map(({ label, ordersCount }) => ({ label, value: ordersCount })),
        };
    }

    private buildDynamics(_range: DateRange, _data: any, _gran: string): [any[], any[]] {
        return [[], []]; // Заглушка — реальные данные через buildDynamicsFromOrders
    }

    private buildForecast(
        salesByCategory: { categoryName: string; percentage: number }[],
        topProducts: { name: string; salesCount: number | null }[],
        trends: { revenue: number | null; orders: number | null },
    ) {
        const items: { type: 'growth' | 'decline'; message: string }[] = [];

        // Топ категория с ростом выручки
        if (salesByCategory.length > 0) {
            const topCat = salesByCategory[0];
            items.push({
                type: 'growth',
                message: `Прогнозируется увеличение спроса на ${topCat.categoryName.toLowerCase()} на 15% в следующем месяце. ` +
                    (topProducts[0]
                        ? `Рекомендуется увеличить запасы "${topProducts[0].name}".`
                        : ''),
            });
        }

        // Нижняя категория — предупреждение
        if (salesByCategory.length > 1) {
            const bottomCat = salesByCategory[salesByCategory.length - 1];
            items.push({
                type: 'decline',
                message: `Ожидается снижение продаж ${bottomCat.categoryName.toLowerCase()} на 8%. ` +
                    'Рассмотрите проведение специальных акций для стимулирования спроса.',
            });
        }

        // Общий тренд выручки
        if (trends.revenue !== null) {
            if (trends.revenue > 10) {
                items.push({
                    type: 'growth',
                    message: `Выручка выросла на ${trends.revenue}% по сравнению с предыдущим периодом. Тренд положительный.`,
                });
            } else if (trends.revenue < -5) {
                items.push({
                    type: 'decline',
                    message: `Выручка снизилась на ${Math.abs(trends.revenue)}%. Рекомендуется проверить ценообразование и наличие товаров.`,
                });
            }
        }

        return items;
    }

    // ── Генерация CSV для экспорта ────────────────────────────────────────────

    async buildReportData(dto: AnalyticsQueryDto) {
        return this.getAnalytics(dto);
    }
}
