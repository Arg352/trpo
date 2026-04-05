import {
    Controller,
    Get,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as path from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const PERIOD_DESC = 'Предустановленный период: week | month | quarter | year. Игнорируется если переданы startDate/endDate.';

// Пути к TTF-шрифтам с поддержкой кириллицы (assets/fonts/*.ttf)
const FONT_REGULAR = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf');
const FONT_BOLD    = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Bold.ttf');

@ApiTags('Analytics (Admin)')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    // GET /admin/analytics
    @Get()
    @ApiOperation({
        summary: 'Аналитика за выбранный период (admin/employee)',
        description: 'Возвращает summary с трендами, графики продаж и заказов, разбивку по категориям, топ-5 товаров и прогноз спроса.',
    })
    @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'], description: PERIOD_DESC })
    @ApiQuery({ name: 'startDate', required: false, description: 'ISO 8601: 2024-01-01. Имеет приоритет над period.' })
    @ApiQuery({ name: 'endDate', required: false, description: 'ISO 8601: 2024-12-31. Используется вместе с startDate.' })
    @ApiResponse({
        status: 200,
        description: 'Аналитические данные за период',
        schema: {
            example: {
                period: { from: '2024-01-01T00:00:00.000Z', to: '2024-12-31T23:59:59.999Z' },
                summary: {
                    totalRevenue: 1200000,
                    totalOrders: 2534,
                    activeClients: 3842,
                    averageReceipt: 473.2,
                    trends: { revenue: 12.5, orders: 8.3, clients: 15.2, averageReceipt: -3.1 },
                },
                salesDynamics: [{ label: '2024-01', value: 98000 }],
                ordersDynamics: [{ label: '2024-01', value: 142 }],
                salesByCategory: [{ categoryName: 'Смартфоны', totalAmount: 540000, percentage: 45 }],
                topProducts: [{ id: 1, name: 'iPhone 13 128GB', sku: 'IP13-128', salesCount: 234, revenue: 10765860 }],
                forecast: [
                    { type: 'growth', message: 'Прогнозируется увеличение спроса на смартфоны на 15%...' },
                    { type: 'decline', message: 'Ожидается снижение продаж планшетов на 8%...' },
                ],
            },
        },
    })
    getAnalytics(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getAnalytics(query);
    }

    // GET /admin/analytics/export — PDF с кириллицей
    @Get('export')
    @ApiOperation({
        summary: 'Экспорт отчёта в PDF (admin/employee)',
        description: 'Генерирует PDF с полным аналитическим отчётом. Использует шрифт Roboto с поддержкой кириллицы.',
    })
    @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiResponse({ status: 200, description: 'PDF-файл отчёта', content: { 'application/pdf': {} } })
    async exportPdf(@Query() query: AnalyticsQueryDto, @Res() res: Response) {
        const data = await this.analyticsService.buildReportData(query);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Регистрируем TTF-шрифты с поддержкой кириллицы
        doc.registerFont('Roboto', FONT_REGULAR);
        doc.registerFont('Roboto-Bold', FONT_BOLD);

        const fromLabel = new Date(data.period.from).toLocaleDateString('ru-RU');
        const toLabel   = new Date(data.period.to).toLocaleDateString('ru-RU');
        const filename  = `analytics_${fromLabel}_${toLabel}.pdf`.replace(/\./g, '-');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const trendStr = (v: number | null) =>
            v === null ? 'н/д' : v >= 0 ? `+${v}%` : `${v}%`;

        // ── Заголовок ──────────────────────────────────────────────────────────
        doc.fontSize(20).font('Roboto-Bold').text('Аналитический отчёт', { align: 'center' });
        doc.fontSize(12).font('Roboto').text(`Период: ${fromLabel} — ${toLabel}`, { align: 'center' });
        doc.moveDown(1.5);

        // ── Сводная статистика ─────────────────────────────────────────────────
        doc.fontSize(14).font('Roboto-Bold').text('Сводная статистика');
        doc.moveDown(0.5).fontSize(11).font('Roboto');
        const { summary } = data;
        doc.text(`Общая выручка:     ${summary.totalRevenue.toLocaleString('ru-RU')} руб.   (тренд: ${trendStr(summary.trends.revenue)})`);
        doc.text(`Всего заказов:     ${summary.totalOrders}   (тренд: ${trendStr(summary.trends.orders)})`);
        doc.text(`Активных клиентов: ${summary.activeClients}   (тренд: ${trendStr(summary.trends.clients)})`);
        doc.text(`Средний чек:       ${summary.averageReceipt.toLocaleString('ru-RU')} руб.   (тренд: ${trendStr(summary.trends.averageReceipt)})`);
        doc.moveDown(1.5);

        // ── Топ-5 товаров ──────────────────────────────────────────────────────
        doc.fontSize(14).font('Roboto-Bold').text('Топ-5 товаров');
        doc.moveDown(0.5).fontSize(11).font('Roboto');
        data.topProducts.forEach((p, i) => {
            doc.text(`${i + 1}. ${p.name} — ${p.salesCount} прод. / ${p.revenue.toLocaleString('ru-RU')} руб.`);
        });
        doc.moveDown(1.5);

        // ── Продажи по категориям ──────────────────────────────────────────────
        doc.fontSize(14).font('Roboto-Bold').text('Продажи по категориям');
        doc.moveDown(0.5).fontSize(11).font('Roboto');
        data.salesByCategory.forEach((c) => {
            doc.text(`${c.categoryName}: ${c.percentage}%  (${c.totalAmount.toLocaleString('ru-RU')} руб.)`);
        });
        doc.moveDown(1.5);

        // ── Динамика продаж ────────────────────────────────────────────────────
        doc.fontSize(14).font('Roboto-Bold').text('Динамика продаж');
        doc.moveDown(0.5).fontSize(11).font('Roboto');
        data.salesDynamics.forEach((row) => {
            doc.text(`${row.label}: ${row.value.toLocaleString('ru-RU')} руб.`);
        });
        doc.moveDown(1.5);

        // ── Прогноз спроса ─────────────────────────────────────────────────────
        doc.fontSize(14).font('Roboto-Bold').text('Прогноз спроса');
        doc.moveDown(0.5).fontSize(11).font('Roboto');
        data.forecast.forEach((f) => {
            doc.text(`${f.type === 'growth' ? '(+)' : '(-)'} ${f.message}`);
            doc.moveDown(0.3);
        });

        // ── Нижний колонтитул ──────────────────────────────────────────────────
        doc.moveDown(2).fontSize(9).fillColor('grey').font('Roboto')
            .text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, { align: 'right' });

        doc.end();
    }
}
