import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_INCLUDE = {
  category: {
    select: { id: true, name: true, slug: true },
  },
  attributeValues: {
    include: {
      attribute: {
        select: { id: true, name: true, unit: true },
      },
    },
  },
  images: {
    orderBy: { sortOrder: 'asc' as const },
  },
  // Рейтинг — кэшируется в Product, доступен в каталоге, акциях и карточке товара
  // averageRating и reviewCount — скалярные поля, включаются автоматически через findMany/findUnique
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(query: GetProductsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      minPrice,
      maxPrice,
      inStock,
      onDiscount,
      sortBy = 'new',
      sortOrder = 'desc',
      attributes,
    } = query;

    // 1. Базовый where
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.name = { contains: search };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) (where.price as any).gte = minPrice;
      if (maxPrice !== undefined) (where.price as any).lte = maxPrice;
    }

    if (inStock) {
      where.stockQuantity = { gt: 0 };
    }

    // Фильтр по наличию скидки (oldPrice != null)
    if (onDiscount) {
      where.oldPrice = { not: null };
    }

    // 2. EAV-фильтрация по динамическим характеристикам
    if (attributes) {
      try {
        const parsed: Record<string, string[]> = JSON.parse(attributes);
        const attrConditions = Object.entries(parsed).map(
          ([attrName, values]) => ({
            attributeValues: {
              some: {
                attribute: { name: attrName },
                value: { in: values },
              },
            },
          }),
        );
        if (attrConditions.length > 0) {
          where.AND = attrConditions;
        }
      } catch {
        // Если JSON невалидный — игнорируем фильтр
      }
    }

    // 3. Сортировка
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sortBy) {
      case 'price':
        orderBy = { price: sortOrder };
        break;
      case 'popular':
        orderBy = { orderItems: { _count: sortOrder } };
        break;
      case 'new':
      default:
        orderBy = { id: sortOrder };
        break;
    }

    // 4. Пагинация
    const skip = (page - 1) * limit;

    // 5. Транзакция: count + findMany
    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: PRODUCT_INCLUDE,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /products/promotions — товары со скидкой для главной страницы
  async findPromotions(limit = 20) {
    const data = await this.prisma.product.findMany({
      where: {
        isActive: true,
        oldPrice: { not: null },   // есть старая цена
        stockQuantity: { gt: 0 },  // в наличии
      },
      take: limit,
      // Сортируем по размеру скидки: сначала товары с наибольшей абсолютной разницей
      // (Prisma не поддерживает сортировку по вычисляемому полю — сортируем по oldPrice desc
      // как хорошую аппроксимацию; точный расчёт выполняет фронтенд)
      orderBy: { oldPrice: 'desc' },
      include: PRODUCT_INCLUDE,
    });

    // Дополнительно вычисляем discountPercent на бэкенде для удобства фронта
    return data.map((p) => ({
      ...p,
      discountPercent: p.oldPrice
        ? Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100)
        : null,
    }));
  }

  // GET /admin/products — все товары для витрины (включая isActive: false)
  async findAllAdmin(search?: string) {
    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      orderBy: { id: 'desc' },
      include: PRODUCT_INCLUDE,
    });
  }

  // GET /admin/products/export — экспорт всех товаров в CSV
  async exportCsv(): Promise<string> {
    const products = await this.prisma.product.findMany({
      include: {
        category: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    const headers = [
      'id', 'sku', 'name', 'category', 'price', 'oldPrice',
      'costPrice', 'stockQuantity', 'minStockLevel', 'supplier',
      'isActive', 'averageRating', 'reviewCount',
    ];

    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` // RFC 4180 экранирование
        : s;
    };

    const rows = products.map((p) =>
      [
        p.id, p.sku, p.name,
        (p as any).category?.name ?? '',
        p.price, p.oldPrice ?? '',
        (p as any).costPrice ?? '',
        p.stockQuantity, (p as any).minStockLevel,
        (p as any).supplier ?? '',
        p.isActive,
        (p as any).averageRating, (p as any).reviewCount,
      ].map(escape).join(','),
    );

    return [headers.join(','), ...rows].join('\r\n');
  }

  // POST /admin/products/import — импорт товаров из CSV (upsert по SKU)
  async importCsv(csvBuffer: Buffer): Promise<{ created: number; updated: number }> {
    const text = csvBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
      return { created: 0, updated: 0 };
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

    // Индексы нужных колонок (толерантно к порядку)
    const idx = (col: string) => headers.indexOf(col);

    let created = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const sku = cols[idx('sku')];

      if (!sku) continue; // строки без артикула пропускаем

      const name = cols[idx('name')] || 'Без названия';
      const price = parseFloat(cols[idx('price')]) || 0;
      const oldPrice = cols[idx('oldPrice')] ? parseFloat(cols[idx('oldPrice')]) : null;
      const costPrice = cols[idx('costPrice')] ? parseFloat(cols[idx('costPrice')]) : null;
      const stockQuantity = parseInt(cols[idx('stockQuantity')], 10) || 0;
      const minStockLevel = parseInt(cols[idx('minStockLevel')], 10) || 5;
      const supplier = cols[idx('supplier')] || null;

      // Находим категорию по имени, если указана
      const categoryName = cols[idx('category')];
      let categoryId: number | undefined;
      if (categoryName) {
        const cat = await this.prisma.category.findFirst({
          where: { name: { equals: categoryName } },
        });
        if (cat) categoryId = cat.id;
      }

      // Ищем товар с таким SKU
      const existing = await this.prisma.product.findUnique({ where: { sku } });

      if (existing) {
        await this.prisma.product.update({
          where: { sku },
          data: {
            name, price, oldPrice, costPrice,
            stockQuantity, minStockLevel, supplier,
            ...(categoryId ? { categoryId } : {}),
          },
        });
        updated++;
      } else {
        await this.prisma.product.create({
          data: {
            sku, name, price, oldPrice, costPrice,
            stockQuantity, minStockLevel, supplier,
            categoryId: categoryId ?? 1, // fallback категория
            isActive: false, // новые товары — черновик
          },
        });
        created++;
      }
    }

    return { created, updated };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(`Товар с id=${id} не найден`);
    }

    return product;
  }

  async create(dto: CreateProductDto) {
    const { attributes, images, ...productData } = dto;

    return this.prisma.product.create({
      data: {
        ...productData,
        // EAV-характеристики
        attributeValues: attributes?.length
          ? {
            createMany: {
              data: attributes.map((a) => ({
                attributeId: a.attributeId,
                value: a.value,
              })),
            },
          }
          : undefined,
        // Галерея: первая картинка — isMain
        images: images?.length
          ? {
            createMany: {
              data: images.map((url, index) => ({
                url,
                isMain: index === 0,
                sortOrder: index,
              })),
            },
          }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    const { attributes, images, ...productData } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Атрибуты: полная замена
      if (attributes !== undefined) {
        await tx.productAttributeValue.deleteMany({
          where: { productId: id },
        });
        if (attributes.length > 0) {
          await tx.productAttributeValue.createMany({
            data: attributes.map((a) => ({
              productId: id,
              attributeId: a.attributeId,
              value: a.value,
            })),
          });
        }
      }

      // Картинки: полная замена
      if (images !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((url, index) => ({
              productId: id,
              url,
              isMain: index === 0,
              sortOrder: index,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: productData,
        include: PRODUCT_INCLUDE,
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Проверяем существование

    // attributeValues удалятся каскадно (onDelete: Cascade в схеме)
    return this.prisma.product.delete({ where: { id } });
  }
}
