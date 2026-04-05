import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompletePosDto } from './dto/complete-pos.dto';

// Статусы, при которых разрешена выдача
const ALLOWED_PICKUP_STATUSES = ['shipped', 'ready_for_pickup', 'new', 'processing'];

// Включаемые данные заказа при поиске
const POS_ORDER_INCLUDE = {
    user: {
        select: { firstName: true, lastName: true, phone: true },
    },
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true, price: true, imageUrl: true },
            },
        },
    },
    payments: {
        select: { paymentMethod: true, amount: true, status: true },
    },
} as const;

@Injectable()
export class PosService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Поиск заказа по коду выдачи.
     * Возвращает состав заказа, суммы и НДС.
     */
    async lookupByCode(code: string) {
        const order = await this.prisma.order.findFirst({
            where: { pickupCode: code },
            include: POS_ORDER_INCLUDE,
        });

        if (!order) {
            throw new NotFoundException(`Заказ с кодом «${code}» не найден`);
        }

        if (order.status === 'delivered') {
            throw new BadRequestException('Этот заказ уже был выдан ранее');
        }

        if (order.status === 'cancelled') {
            throw new BadRequestException('Этот заказ отменён и не может быть выдан');
        }

        if (!ALLOWED_PICKUP_STATUSES.includes(order.status ?? '')) {
            throw new BadRequestException(
                `Заказ не готов к выдаче. Текущий статус: «${order.status}»`,
            );
        }

        // Рассчитываем НДС (20%)
        const subtotal = Number(order.totalAmount);
        const vatRate = 0.20;
        const vatAmount = +(subtotal * vatRate / (1 + vatRate)).toFixed(2); // НДС включён в цену
        const isPaidOnline = order.payments.some((p) => p.status === 'paid');

        return {
            id: order.id,
            pickupCode: order.pickupCode,
            status: order.status,
            deliveryType: order.deliveryType,
            customer: order.user,
            items: order.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                name: item.product.name,
                sku: item.product.sku,
                imageUrl: item.product.imageUrl,
                quantity: item.quantity,
                priceAtMoment: Number(item.priceAtMoment),
                lineTotal: +(Number(item.priceAtMoment) * item.quantity).toFixed(2),
            })),
            pricing: {
                subtotal: +subtotal.toFixed(2),
                vat20: vatAmount,
                total: +subtotal.toFixed(2), // total уже включает НДС
            },
            isPaidOnline,
        };
    }

    /**
     * Выдача заказа: смена статуса + фиксация оплаты при получении.
     */
    async completeOrder(dto: CompletePosDto) {
        const order = await this.prisma.order.findFirst({
            where: { pickupCode: dto.pickupCode },
            select: { id: true, status: true, totalAmount: true, payments: { select: { status: true } } },
        });

        if (!order) {
            throw new NotFoundException(`Заказ с кодом «${dto.pickupCode}» не найден`);
        }

        if (order.status === 'delivered') {
            throw new BadRequestException('Этот заказ уже был выдан ранее');
        }

        if (order.status === 'cancelled') {
            throw new BadRequestException('Этот заказ отменён');
        }

        // Транзакция: обновляем заказ + создаём Payment если оплата при получении
        return this.prisma.$transaction(async (tx) => {
            // Обновляем статус и фиксируем метод оплаты при получении
            const updated = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'delivered',
                    paymentOnDelivery: dto.paymentMethod ?? null,
                },
                include: POS_ORDER_INCLUDE,
            });

            // Если оплата происходит при выдаче — создаём запись Payment
            if (dto.paymentMethod) {
                await tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: order.totalAmount,
                        paymentMethod: dto.paymentMethod,
                        status: 'paid',
                    },
                });
            }

            return {
                success: true,
                message: 'Заказ успешно выдан!',
                orderId: updated.id,
                status: updated.status,
                paymentMethod: dto.paymentMethod ?? 'Оплачен онлайн',
            };
        });
    }
}
