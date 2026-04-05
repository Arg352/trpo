import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('Admin Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class AdminAnalyticsController {
    constructor(private readonly adminAnalyticsService: AdminAnalyticsService) { }

    // GET /admin/analytics/dashboard — данные для дашборда панели управления
    @Get('dashboard')
    @ApiOperation({
        summary: 'Данные для дашборда B2B-панели (admin/employee)',
        description: `Возвращает:
- kpi: продажи/заказы за 7 дней с % ростом, общий склад, кол-во клиентов
- charts: массив из 7 точек для графиков (продажи и кол-во заказов по дням)
- lastOrders: последние 5 заказов
- lowStockProducts: товары с остатком ≤ 5 шт.`,
    })
    getDashboard() {
        return this.adminAnalyticsService.getDashboard();
    }
}
