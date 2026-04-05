import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerStatusDto } from './dto/update-banner-status.dto';

@Injectable()
export class BannersService {
    constructor(private readonly prisma: PrismaService) { }

    // Только активные баннеры (для фронтенда)
    async findActive() {
        return this.prisma.promoBanner.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Создать новый баннер
    async create(dto: CreateBannerDto) {
        return this.prisma.promoBanner.create({ data: dto });
    }

    // Включить / выключить баннер
    async updateStatus(id: number, dto: UpdateBannerStatusDto) {
        const banner = await this.prisma.promoBanner.findUnique({
            where: { id },
        });
        if (!banner) {
            throw new NotFoundException(`Баннер с id=${id} не найден`);
        }

        return this.prisma.promoBanner.update({
            where: { id },
            data: { isActive: dto.isActive },
        });
    }

    // Удалить баннер
    async remove(id: number) {
        const banner = await this.prisma.promoBanner.findUnique({
            where: { id },
        });
        if (!banner) {
            throw new NotFoundException(`Баннер с id=${id} не найден`);
        }

        return this.prisma.promoBanner.delete({ where: { id } });
    }
}
