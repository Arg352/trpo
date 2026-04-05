import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class PaymentsService {
    constructor(private readonly prisma: PrismaService) { }

    async processMockPayment(
        userId: number,
        orderId: number,
        dto: ProcessPaymentDto,
    ) {
        // 1. Находим заказ и проверяем доступность
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order || order.userId !== userId || order.status !== 'new') {
            throw new BadRequestException('Заказ недоступен для оплаты');
        }

        // 2. Транзакция: создаём Payment + обновляем статус Order
        const transactionUuid = randomUUID();

        await this.prisma.$transaction([
            this.prisma.payment.create({
                data: {
                    orderId,
                    amount: order.totalAmount,
                    paymentMethod: dto.paymentMethod,
                    status: 'success',
                    transactionUuid,
                },
            }),
            this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'processing' },
            }),
        ]);

        return {
            success: true,
            transactionId: transactionUuid,
            message: 'Оплата успешно проведена (Mock)',
        };
    }
}
