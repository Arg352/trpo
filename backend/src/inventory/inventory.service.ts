import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

// Поля, которые возвращает складской список (без маркетинговых данных)
const INVENTORY_SELECT = {
    id: true,
    sku: true,
    name: true,
    stockQuantity: true,
    minStockLevel: true,
    costPrice: true,
    supplier: true,
    isActive: true,
    price: true,
    category: {
        select: { id: true, name: true, slug: true },
    },
} as const;

@Injectable()
export class InventoryService {
    constructor(private readonly prisma: PrismaService) { }

    // GET /admin/inventory — все товары для склада (поиск по name/sku)
    async findAll(search?: string) {
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { sku: { contains: search } },
            ];
        }

        const products = await this.prisma.product.findMany({
            where,
            select: INVENTORY_SELECT,
            orderBy: { name: 'asc' },
        });

        // Добавляем вычисляемое поле isLow
        return products.map((p) => ({
            ...p,
            isLow: p.stockQuantity <= p.minStockLevel,
        }));
    }

    // POST /admin/inventory — завести новый товар на склад (черновик)
    async create(dto: CreateInventoryItemDto) {
        return this.prisma.product.create({
            data: {
                name: dto.name,
                sku: dto.sku,
                categoryId: dto.categoryId,
                stockQuantity: dto.stockQuantity ?? 0,
                minStockLevel: dto.minStockLevel ?? 5,
                price: dto.price ?? 0,
                costPrice: dto.costPrice,
                supplier: dto.supplier,
                isActive: false, // всегда черновик — активировать может только admin
            },
            select: INVENTORY_SELECT,
        });
    }

    // PATCH /admin/inventory/:productId — оприходование / списание
    async updateStock(productId: number, userId: number, dto: UpdateStockDto) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, stockQuantity: true },
        });

        if (!product) {
            throw new NotFoundException(`Товар с id=${productId} не найден`);
        }

        const newQuantity = product.stockQuantity + dto.changeAmount;

        if (newQuantity < 0) {
            throw new BadRequestException(
                `Нельзя списать ${Math.abs(dto.changeAmount)} шт. На складе только ${product.stockQuantity} шт.`,
            );
        }

        // Атомарная транзакция: обновить остаток + создать лог
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { id: productId },
                data: { stockQuantity: newQuantity },
                select: INVENTORY_SELECT,
            });

            await tx.inventoryLog.create({
                data: {
                    productId,
                    userId,       // аудит: кто изменил
                    changeAmount: dto.changeAmount,
                    reason: dto.reason,
                },
            });

            return {
                ...updated,
                isLow: updated.stockQuantity <= updated.minStockLevel,
                log: {
                    changeAmount: dto.changeAmount,
                    reason: dto.reason,
                    newQuantity,
                },
            };
        });
    }
}
