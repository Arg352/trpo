import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // ─── СТАРШИЙ МЕНЕДЖЕР ─────────────────────────────────────────────

    @Get('manager/pending')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Заказы для старшего менеджера (новые + в обработке)' })
    getManagerOrders() {
        return this.ordersService.getManagerOrders();
    }

    @Get('manager/teams')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Список бригад' })
    getTeams() {
        return this.ordersService.getTeams();
    }

    @Patch(':id/assign-team')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Назначить бригаду на заказ' })
    assignTeam(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { teamId: number },
    ) {
        return this.ordersService.assignTeam(id, dto.teamId);
    }

    @Patch(':id/unassign-team')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Снять бригаду с заказа' })
    unassignTeam(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.unassignTeam(id);
    }

    @Get('manager/kpis')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    @ApiOperation({ summary: 'KPI: Line Items в час, Error Rate' })
    getKPIs() {
        return this.ordersService.getKPIs();
    }

    // ─── БРИГАДИР ─────────────────────────────────────────────────────

    @Get('foreman/team-orders')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    @ApiOperation({ summary: 'Заказы бригады (в обработке)' })
    getForemanOrders(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getForemanOrders(req.user.sub);
    }

    @Get('foreman/team-members')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    @ApiOperation({ summary: 'Сотрудники бригады' })
    getTeamMembers(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getTeamMembers(req.user.sub);
    }

    @Patch(':id/assign-worker')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    @ApiOperation({ summary: 'Назначить работника на заказ' })
    assignWorker(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { workerId: number },
    ) {
        return this.ordersService.assignWorker(req.user.sub, id, dto.workerId);
    }

    @Patch(':id/unassign-worker')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    @ApiOperation({ summary: 'Снять работника с заказа' })
    unassignWorker(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.unassignWorker(id);
    }

    // ─── СБОРЩИК (И ОСТАЛЬНЫЕ) ────────────────────────────────────────

    @Get('worker/orders')
    @UseGuards(RolesGuard)
    @Roles('worker', 'foreman')
    @ApiOperation({ summary: 'Мои заказы на сборку (сборщик)' })
    getWorkerOrders(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getWorkerOrders(req.user.sub);
    }

    @Patch('items/:itemId/pack')
    @UseGuards(RolesGuard)
    @Roles('worker', 'foreman', 'senior_manager')
    @ApiOperation({ summary: 'Упаковать товар (или зафиксировать ошибку)' })
    packItem(
        @Param('itemId', ParseIntPipe) itemId: number,
        @Body() dto: { packed: boolean, hasError?: boolean },
    ) {
        return this.ordersService.packItem(itemId, dto);
    }

    @Patch(':id/finish-picking')
    @UseGuards(RolesGuard)
    @Roles('worker', 'foreman')
    @ApiOperation({ summary: 'Завершить сборку (перевести в статус packed)' })
    finishPicking(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.ordersService.finishPicking(req.user.sub, id);
    }
}
