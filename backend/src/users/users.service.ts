import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    // Получить профиль текущего пользователя
    async getMe(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                status: true,
                breakStatus: true,
                createdAt: true,
                role: {
                    select: { id: true, name: true, description: true },
                },
                team: { select: { id: true, name: true } },
            },
        });

        if (!user) return null;
        return user;
    }

    // Обновить профиль
    async updateMe(userId: number, dto: any) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Пользователь не найден');

        const data: any = {};
        if (dto.firstName !== undefined) data.firstName = dto.firstName;
        if (dto.lastName !== undefined) data.lastName = dto.lastName;
        if (dto.phone !== undefined) data.phone = dto.phone;
        if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                status: true,
                breakStatus: true,
                createdAt: true,
            },
        });
    }

    // Методы forgotPassword и resetPassword обычно реализуются в AuthService
    // Но если они нужны здесь, вы можете добавить их логику, например,
    // отправку email токена.
}
