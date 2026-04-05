import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BuyNowDto } from './dto/buy-now.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VerifyPickupDto } from './dto/verify-pickup.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // GET /orders/my — история заказов (явный алиас для фронтенда)
    @Get('my')
    @ApiOperation({ summary: 'История заказов текущего пользователя' })
    getMyOrdersAlias(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getMyOrders(req.user.sub);
    }

    // GET /orders — история заказов текущего пользователя (основной роут)
    @Get()
    getMyOrders(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getMyOrders(req.user.sub);
    }

    // GET /orders/admin/all — все заказы с поиском и фильтром по статусу
    @Get('admin/all')
    @UseGuards(RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({ summary: 'Все заказы (admin/employee) с поиском и фильтром' })
    getAllOrders(
        @Query('search') search?: string,
        @Query('status') status?: string,
    ) {
        return this.ordersService.getAllOrders(search, status);
    }

    // GET /orders/manager/pending — заказы для старшего менеджера (новые + в обработке)
    @Get('manager/pending')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    getManagerOrders() {
        return this.ordersService.getManagerOrders();
    }

    // GET /orders/manager/teams — список бригад
    @Get('manager/teams')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    getTeams() {
        return this.ordersService.getTeams();
    }

    // PATCH /orders/:id/assign-team — назначить бригаду на заказ
    @Patch(':id/assign-team')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    assignTeam(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { teamId: number },
    ) {
        return this.ordersService.assignTeam(id, dto.teamId);
    }

    // PATCH /orders/:id/unassign-team — снять бригаду с заказа
    @Patch(':id/unassign-team')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    unassignTeam(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.unassignTeam(id);
    }

    // GET /orders/foreman/team-orders — заказы бригады
    @Get('foreman/team-orders')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    getForemanOrders(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getForemanOrders(req.user.sub);
    }

    // GET /orders/foreman/team-members — сотрудники бригады
    @Get('foreman/team-members')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    getTeamMembers(@Request() req: { user: JwtPayload }) {
        return this.ordersService.getTeamMembers(req.user.sub);
    }

    // PATCH /orders/:id/assign-worker — назначить работника на заказ
    @Patch(':id/assign-worker')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    assignWorker(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { workerId: number },
    ) {
        return this.ordersService.assignWorker(req.user.sub, id, dto.workerId);
    }

    // PATCH /orders/:id/unassign-worker — снять работника с заказа
    @Patch(':id/unassign-worker')
    @UseGuards(RolesGuard)
    @Roles('foreman')
    unassignWorker(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.unassignWorker(id);
    }

    // PATCH /orders/items/:itemId/pack — упаковать товар
    @Patch('items/:itemId/pack')
    @UseGuards(RolesGuard)
    @Roles('worker', 'foreman', 'senior_manager')
    packItem(
        @Param('itemId', ParseIntPipe) itemId: number,
        @Body() dto: { packed: boolean },
    ) {
        return this.ordersService.packItem(itemId, dto.packed);
    }

    // GET /orders/admin/:id — детали одного заказа без ограничения по userId
    @Get('admin/:id')
    @UseGuards(RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({ summary: 'Детали заказа по ID (admin/employee)' })
    getAdminOrder(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.getAdminOrder(id);
    }

    // POST /orders/checkout — оформить заказ
    @Post('checkout')
    checkout(
        @Request() req: { user: JwtPayload },
        @Body() dto: CheckoutDto,
    ) {
        return this.ordersService.checkout(req.user.sub, dto);
    }

    // POST /orders/buy-now — купить сейчас (в обход корзины)
    @Post('buy-now')
    @ApiOperation({
        summary: 'Купить сейчас — оформить заказ на один товар без корзины',
    })
    buyNow(
        @Request() req: { user: JwtPayload },
        @Body() dto: BuyNowDto,
    ) {
        return this.ordersService.buyNow(req.user.sub, dto);
    }


    // POST /orders/verify-pickup — сотрудник проверяет код и выдаёт заказ
    @Post('verify-pickup')
    @UseGuards(RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({
        summary: 'Проверка кода выдачи и завершение заказа (admin/employee)',
    })
    verifyPickup(@Body() dto: VerifyPickupDto) {
        return this.ordersService.verifyPickup(dto);
    }

    // GET /orders/:id — один заказ пользователя
    @Get(':id')
    getOrder(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.ordersService.getOrder(req.user.sub, id);
    }

    // GET /orders/:id/pickup-code — получить код выдачи (покупатель)
    @Get(':id/pickup-code')
    @ApiOperation({
        summary: 'Получить код выдачи заказа (доступен при статусе shipped)',
    })
    getPickupCode(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.ordersService.getPickupCode(req.user.sub, id);
    }

    // PATCH /orders/:id/status — изменить статус заказа (админ/сотрудник)
    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({ summary: 'Изменить статус заказа (admin/employee)' })
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, dto);
    }
}


