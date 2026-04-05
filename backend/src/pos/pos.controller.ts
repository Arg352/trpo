import {
    Body,
    Controller,
    Get,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompletePosDto } from './dto/complete-pos.dto';
import { PosService } from './pos.service';

@ApiTags('POS')
@ApiBearerAuth()
@Controller('admin/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class PosController {
    constructor(private readonly posService: PosService) { }

    /**
     * GET /admin/pos/lookup?code=1GWE3W0Q1P
     * Поиск заказа по 10-значному коду выдачи.
     * Возвращает полный состав заказа + расчёт НДС для кассового экрана.
     */
    @Get('lookup')
    @ApiOperation({
        summary: 'Найти заказ по коду выдачи (POS)',
        description:
            'Ищет заказ по pickupCode. Возвращает состав, суммы с НДС (20%) и статус оплаты. ' +
            'Ошибка если заказ уже выдан, отменён или не готов к выдаче.',
    })
    @ApiQuery({
        name: 'code',
        required: true,
        description: '10-значный код выдачи, который продиктовал покупатель (напр. 1GWE3W0Q1P)',
    })
    @ApiResponse({
        status: 200,
        description: 'Заказ найден и готов к выдаче',
        schema: {
            example: {
                id: 42,
                pickupCode: '1GWE3W0Q1P',
                status: 'shipped',
                deliveryType: 'pickup',
                customer: { firstName: 'Иван', lastName: 'Иванов', phone: '+7 999 000 00 00' },
                items: [
                    {
                        id: 1, productId: 5, name: 'Samsung Galaxy S23',
                        sku: 'SGS23-256', quantity: 1,
                        priceAtMoment: 78500, lineTotal: 78500,
                    },
                ],
                pricing: { subtotal: 78500, vat20: 13083.33, total: 78500 },
                isPaidOnline: false,
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Код не найден' })
    @ApiResponse({ status: 400, description: 'Заказ уже выдан, отменён или не готов' })
    lookup(@Query('code') code: string) {
        return this.posService.lookupByCode(code);
    }

    /**
     * POST /admin/pos/complete
     * Выдаёт заказ: статус → 'delivered', фиксирует оплату.
     */
    @Post('complete')
    @ApiOperation({
        summary: 'Выдать заказ (POS)',
        description:
            'Меняет статус заказа на "delivered". ' +
            'Если paymentMethod передан — создаёт запись оплаты при получении. ' +
            'Если null/не передан — считается, что заказ был оплачен онлайн.',
    })
    @ApiResponse({
        status: 200,
        description: 'Заказ успешно выдан',
        schema: {
            example: {
                success: true,
                message: 'Заказ успешно выдан!',
                orderId: 42,
                status: 'delivered',
                paymentMethod: 'card',
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Код не найден' })
    @ApiResponse({ status: 400, description: 'Заказ уже выдан или отменён' })
    complete(@Body() dto: CompletePosDto) {
        return this.posService.completeOrder(dto);
    }
}
