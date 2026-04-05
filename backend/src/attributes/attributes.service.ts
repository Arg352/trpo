import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

@Injectable()
export class AttributesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.attribute.findMany({
            select: { id: true, name: true, unit: true },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: number) {
        const attribute = await this.prisma.attribute.findUnique({
            where: { id },
            select: { id: true, name: true, unit: true },
        });

        if (!attribute) {
            throw new NotFoundException(`Атрибут с id=${id} не найден`);
        }

        return attribute;
    }

    async create(dto: CreateAttributeDto) {
        const existing = await this.prisma.attribute.findFirst({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException(
                `Атрибут с названием "${dto.name}" уже существует`,
            );
        }

        return this.prisma.attribute.create({
            data: dto,
            select: { id: true, name: true, unit: true },
        });
    }

    async update(id: number, dto: UpdateAttributeDto) {
        await this.findOne(id); // Проверяем существование

        return this.prisma.attribute.update({
            where: { id },
            data: dto,
            select: { id: true, name: true, unit: true },
        });
    }

    async remove(id: number) {
        await this.findOne(id); // Проверяем существование

        return this.prisma.attribute.delete({ where: { id } });
    }
}
