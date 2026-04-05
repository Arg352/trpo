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
        return this.prisma.category.findMany({
            include: {
                attributes: {
                    include: {
                        attribute: {
                            select: { id: true, name: true, unit: true },
                        },
                    },
                },
            },
        });
    }

    async findOne(id: number) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                attributes: {
                    include: {
                        attribute: {
                            select: { id: true, name: true, unit: true },
                        },
                    },
                },
            },
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

        // 2. Все значения характеристик активных товаров
        const attrValues = await this.prisma.productAttributeValue.findMany({
            where: {
                product: { categoryId, isActive: true },
            },
            include: {
                attribute: { select: { name: true, unit: true } },
            },
        });

        // 3. Группировка: имя атрибута → уникальные значения
        const grouped = new Map<string, Set<string>>();
        for (const av of attrValues) {
            const name = av.attribute.name;
            if (!grouped.has(name)) {
                grouped.set(name, new Set());
            }
            grouped.get(name)!.add(av.value);
        }

        const attributes = Array.from(grouped.entries()).map(
            ([name, valuesSet]) => ({
                name,
                values: Array.from(valuesSet),
            }),
        );

        return {
            minPrice: Number(priceAgg._min.price) || 0,
            maxPrice: Number(priceAgg._max.price) || 0,
            attributes,
        };
    }
}
