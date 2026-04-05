import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

// Include для отзыва: user (только publicName и avatarUrl) + media (фото)
const REVIEW_INCLUDE = {
    user: {
        select: {
            id: true,
            publicName: true, // отображаемое имя (например, "Дмитрий Г.")
            avatarUrl: true,
        },
    },
    media: {
        select: {
            id: true,
            url: true,
        },
    },
} as const;

@Injectable()
export class ReviewsService {
    constructor(private readonly prisma: PrismaService) { }

    // GET /products/:productId/reviews — список отзывов к товару (публичный)
    async findByProduct(productId: number) {
        // Проверяем: товар существует?
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, averageRating: true, reviewCount: true },
        });
        if (!product) {
            throw new NotFoundException(`Товар с id=${productId} не найден`);
        }

        const reviews = await this.prisma.review.findMany({
            where: { productId },
            include: REVIEW_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });

        return {
            averageRating: product.averageRating,
            reviewCount: product.reviewCount,
            reviews,
        };
    }

    // POST /products/:productId/reviews — создать отзыв (авторизованный)
    async create(userId: number, productId: number, dto: CreateReviewDto) {
        // 1. Проверяем: товар существует?
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new NotFoundException(`Товар с id=${productId} не найден`);
        }

        // 2. Проверяем: пользователь уже оставлял отзыв на этот товар?
        const existing = await this.prisma.review.findFirst({
            where: { userId, productId },
        });
        if (existing) {
            throw new ConflictException('Вы уже оставили отзыв на этот товар');
        }

        // 3. Транзакция: создаём отзыв + пересчитываем статистику продукта
        return this.prisma.$transaction(async (tx) => {
            // Создаём отзыв с вложенными медиафайлами
            const review = await tx.review.create({
                data: {
                    userId,
                    productId,
                    rating: dto.rating,
                    pros: dto.pros,
                    cons: dto.cons,
                    media: dto.mediaUrls?.length
                        ? {
                            createMany: {
                                data: dto.mediaUrls.map((url) => ({ url })),
                            },
                        }
                        : undefined,
                },
                include: REVIEW_INCLUDE,
            });

            // Пересчитываем средний рейтинг и количество отзывов
            const stats = await tx.review.aggregate({
                where: { productId },
                _avg: { rating: true },
                _count: { id: true },
            });

            await tx.product.update({
                where: { id: productId },
                data: {
                    averageRating: +(stats._avg.rating?.toFixed(1) ?? 0),
                    reviewCount: stats._count.id,
                },
            });

            return review;
        });
    }
}
