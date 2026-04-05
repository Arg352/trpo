import {
    Body,
    Controller,
    Param,
    ParseIntPipe,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('mock/:orderId')
    @ApiOperation({
        summary: 'Mock-оплата заказа (симуляция)',
        description:
            'Создаёт запись Payment со статусом success и переводит заказ в processing. Работает только для заказов со статусом new.',
    })
    processMockPayment(
        @Request() req: { user: JwtPayload },
        @Param('orderId', ParseIntPipe) orderId: number,
        @Body() dto: ProcessPaymentDto,
    ) {
        return this.paymentsService.processMockPayment(
            req.user.sub,
            orderId,
            dto,
        );
    }
}
