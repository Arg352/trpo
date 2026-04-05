import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.category.findMany();
    }

    async findOne(id: number) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException(`Категория с id=${id} не найдена`);
        }

        return category;
    }

    async create(dto: CreateCategoryDto) {
        const existing = await this.prisma.category.findFirst({
            where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
        });

        if (existing) {
            throw new ConflictException(
                'Категория с таким названием или slug уже существует',
            );
        }

        return this.prisma.category.create({ data: dto });
    }

    async update(id: number, dto: UpdateCategoryDto) {
        await this.findOne(id); // Проверяем существование

        return this.prisma.category.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: number) {
        await this.findOne(id);

        return this.prisma.category.delete({ where: { id } });
    }

    // Мета-данные для сайдбара фильтров
    async getCategoryFilters(categoryId: number) {
        await this.findOne(categoryId); // Проверяем существование

        // 1. Мин/макс цена товаров в категории
        const priceAgg = await this.prisma.product.aggregate({
            where: { categoryId, isActive: true },
            _min: { price: true },
            _max: { price: true },
        });

        return {
            minPrice: Number(priceAgg._min.price) || 0,
            maxPrice: Number(priceAgg._max.price) || 0,
            attributes: [],
        };
    }
}
