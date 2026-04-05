import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
    constructor(private readonly prisma: PrismaService) { }

    // Toggle: добавить / удалить из избранного
    async toggle(userId: number, productId: number) {
        // Проверяем существование товара
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new NotFoundException(`Товар с id=${productId} не найден`);
        }

        // Ищем существующую запись
        const existing = await this.prisma.favorite.findUnique({
            where: { userId_productId: { userId, productId } },
        });

        if (existing) {
            // Удаляем (дизлайк)
            await this.prisma.favorite.delete({
                where: { id: existing.id },
            });
            return { isFavorite: false };
        }

        // Создаём (лайк)
        await this.prisma.favorite.create({
            data: { userId, productId },
        });
        return { isFavorite: true };
    }

    // Список избранных товаров пользователя
    async getMyFavorites(userId: number) {
        const favorites = await this.prisma.favorite.findMany({
            where: { userId },
            include: {
                product: {
                    include: {
                        images: { orderBy: { sortOrder: 'asc' } },
                        category: { select: { id: true, name: true, slug: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Возвращаем массив товаров (удобнее для фронта)
        return favorites.map((f) => f.product);
    }
}
