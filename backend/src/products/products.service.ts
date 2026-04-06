import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PRODUCT_INCLUDE = {
  category: {
    select: { id: true, name: true, slug: true },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(query: any) {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      inStock,
      sortBy = 'id',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { storageCell: { contains: search } },
      ];
    }

    if (inStock) {
      where.stockQuantity = { gt: 0 };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortOrder };

    const skip = (page - 1) * limit;

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

  async create(dto: any) {
    const { images, ...productData } = dto;

    return this.prisma.product.create({
      data: productData,
      include: PRODUCT_INCLUDE,
    });
  }

  async update(id: number, dto: any) {
    await this.findOne(id);

    const { images, ...productData } = dto;

    return this.prisma.product.update({
      where: { id },
      data: productData,
      include: PRODUCT_INCLUDE,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }
}
