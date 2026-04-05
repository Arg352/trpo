import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

// Общий include для корзины с товарами (включая oldPrice для расчёта скидки)
const CART_INCLUDE = {
    items: {
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    oldPrice: true,      // для расчёта скидки
                    imageUrl: true,
                    stockQuantity: true,
                    sku: true,
                    averageRating: true, // для звёзд в корзине
                    reviewCount: true,
                },
            },
        },
    },
} as const;

// Вычисляет итоговые поля корзины из списка позиций
function computeCartSummary(items: Array<{
    quantity: number;
    product: { price: unknown; oldPrice: unknown };
}>) {
    let totalAmount = 0;
    let totalDiscount = 0;
    let totalItems = 0;

    for (const item of items) {
        const price = Number(item.product.price);
        const oldPrice = item.product.oldPrice ? Number(item.product.oldPrice) : null;
        const qty = item.quantity;

        totalAmount += price * qty;
        totalItems += qty;

        if (oldPrice && oldPrice > price) {
            totalDiscount += (oldPrice - price) * qty;
        }
    }

    return {
        totalAmount: +totalAmount.toFixed(2),
        totalDiscount: +totalDiscount.toFixed(2),
        totalItems,
    };
}

@Injectable()
export class CartService {
    constructor(private readonly prisma: PrismaService) { }

    // Возвращает активную корзину или создаёт новую
    async getActiveCart(userId: number) {
        const existingCart = await this.prisma.order.findFirst({
            where: { userId, status: 'cart' },
            include: CART_INCLUDE,
        });

        if (existingCart) return existingCart;

        // Создаём пустую корзину (deliveryType = 'pending' до оформления заказа)
        return this.prisma.order.create({
            data: {
                userId,
                status: 'cart',
                deliveryType: 'pending',
                totalAmount: 0,
            },
            include: CART_INCLUDE,
        });
    }

    // GET /cart — возвращает корзину с вычисленными полями для блока «Итого»
    async getCart(userId: number) {
        const cart = await this.getActiveCart(userId);
        const summary = computeCartSummary(cart.items);

        return {
            id: cart.id,
            status: cart.status,
            deliveryType: cart.deliveryType,
            deliveryAddress: cart.deliveryAddress,
            createdAt: cart.createdAt,
            items: cart.items,
            // Блок «Итого» для UI
            totalAmount: summary.totalAmount,    // К оплате (price * qty)
            totalDiscount: summary.totalDiscount, // Экономия ((oldPrice - price) * qty)
            totalItems: summary.totalItems,       // Общее кол-во единиц товаров
        };
    }

    async addToCart(userId: number, dto: AddToCartDto) {
        const { productId, quantity } = dto;

        // 1. Получаем товар и проверяем наличие
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new NotFoundException(`Товар с id=${productId} не найден`);
        }
        if (product.stockQuantity < quantity) {
            throw new BadRequestException(
                `Недостаточно товара на складе. Доступно: ${product.stockQuantity} шт.`,
            );
        }

        // 2. Получаем корзину (или создаём)
        const cart = await this.getActiveCart(userId);

        // 3. Проверяем: товар уже в корзине?
        const existingItem = await this.prisma.orderItem.findFirst({
            where: { orderId: cart.id, productId },
        });

        const newQuantity = existingItem
            ? existingItem.quantity + quantity
            : quantity;

        // Проверяем суммарное количество с учётом уже добавленного
        if (newQuantity > product.stockQuantity) {
            throw new BadRequestException(
                `Нельзя добавить ${quantity} шт. В корзине уже ${existingItem?.quantity ?? 0} шт. Доступно: ${product.stockQuantity} шт.`,
            );
        }

        // 4. Обновляем или создаём OrderItem
        if (existingItem) {
            await this.prisma.orderItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQuantity },
            });
        } else {
            await this.prisma.orderItem.create({
                data: {
                    orderId: cart.id,
                    productId,
                    quantity,
                    priceAtMoment: product.price,
                },
            });
        }

        // 5. Пересчитываем и возвращаем обновлённую корзину
        return this.recalculateAndReturn(cart.id, userId);
    }

    async removeFromCart(userId: number, productId: number) {
        const cart = await this.getActiveCart(userId);

        const item = await this.prisma.orderItem.findFirst({
            where: { orderId: cart.id, productId },
        });

        if (!item) {
            throw new NotFoundException('Этот товар не найден в корзине');
        }

        await this.prisma.orderItem.delete({ where: { id: item.id } });

        return this.recalculateAndReturn(cart.id, userId);
    }

    // Обновляет totalAmount в БД и возвращает корзину с полным summary
    private async recalculateAndReturn(cartId: number, userId: number) {
        // Получаем актуальные позиции с ценами
        const freshCart = await this.prisma.order.findUnique({
            where: { id: cartId },
            include: CART_INCLUDE,
        });

        if (!freshCart) throw new NotFoundException('Корзина не найдена');

        const summary = computeCartSummary(freshCart.items);

        // Сохраняем totalAmount в БД для оформления заказа
        await this.prisma.order.update({
            where: { id: cartId },
            data: { totalAmount: summary.totalAmount },
        });

        return {
            id: freshCart.id,
            status: freshCart.status,
            deliveryType: freshCart.deliveryType,
            deliveryAddress: freshCart.deliveryAddress,
            createdAt: freshCart.createdAt,
            items: freshCart.items,
            totalAmount: summary.totalAmount,
            totalDiscount: summary.totalDiscount,
            totalItems: summary.totalItems,
        };
    }
}
