import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Вспомогательный: вычислить массив codes полномочий юзера ────────────

    async getPermissions(userId: number): Promise<string[]> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                role: { select: { name: true } },
                responsibilities: {
                    select: { responsibility: { select: { code: true } } },
                },
            },
        });

        if (!user) return [];

        if (user.role.name === 'admin') {
            // Администратор = суперпользователь: все существующие коды
            const all = await this.prisma.responsibility.findMany({
                select: { code: true },
            });
            return all.map((r) => r.code);
        }

        // Employee: только назначенные
        return user.responsibilities.map((ur) => ur.responsibility.code);
    }

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
                publicName: true,
                phone: true,
                avatarUrl: true,
                status: true,
                createdAt: true,
                role: {
                    select: { id: true, name: true, description: true },
                },
                savedAddresses: {
                    select: {
                        id: true,
                        city: true,
                        addressText: true,
                        isDefault: true,
                    },
                },
                savedCards: {
                    select: {
                        id: true,
                        brand: true,
                        last4Digits: true,
                        cardHolder: true,
                        isDefault: true,
                    },
                },
                // Счётчик избранного — для виджета на экране Настройки
                _count: {
                    select: { favorites: true },
                },
            },
        });

        if (!user) return null;

        const permissions = await this.getPermissions(userId);
        return { ...user, permissions };
    }

    // Обновить профиль (firstName, lastName, phone, avatarUrl, publicName)
    async updateMe(userId: number, dto: UpdateProfileDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Пользователь не найден');

        return this.prisma.user.update({
            where: { id: userId },
            data: dto,
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                publicName: true,
                phone: true,
                avatarUrl: true,
                status: true,
                createdAt: true,
            },
        });
    }

    // ─── АДРЕСА ДОСТАВКИ ──────────────────────────────────────────────────────

    // Добавить адрес доставки
    async addAddress(userId: number, dto: CreateAddressDto) {
        // Если новый адрес помечается как основной — снимаем флаг с остальных
        if (dto.isDefault) {
            await this.prisma.savedAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        return this.prisma.savedAddress.create({
            data: {
                userId,
                city: dto.city,
                addressText: dto.addressText,
                isDefault: dto.isDefault ?? false,
            },
        });
    }

    // Удалить адрес доставки (только свой)
    async deleteAddress(userId: number, addressId: number) {
        const address = await this.prisma.savedAddress.findUnique({
            where: { id: addressId },
        });

        if (!address) {
            throw new NotFoundException(`Адрес #${addressId} не найден`);
        }
        if (address.userId !== userId) {
            throw new ForbiddenException('Нет доступа к этому адресу');
        }

        await this.prisma.savedAddress.delete({ where: { id: addressId } });

        return { message: 'Адрес удалён' };
    }

    // ─── СОХРАНЁННЫЕ КАРТЫ ────────────────────────────────────────────────────

    // Добавить фейковую карту
    async addCard(userId: number, dto: CreateCardDto) {
        // Если новая карта помечается как основная — снимаем флаг с остальных
        if (dto.isDefault) {
            await this.prisma.savedCard.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        return this.prisma.savedCard.create({
            data: {
                userId,
                brand: dto.brand,
                last4Digits: dto.last4Digits,
                cardHolder: dto.cardHolder,
                isDefault: dto.isDefault ?? false,
            },
            select: {
                id: true,
                brand: true,
                last4Digits: true,
                cardHolder: true,
                isDefault: true,
                createdAt: true,
            },
        });
    }

    // Удалить карту (только свою)
    async deleteCard(userId: number, cardId: number) {
        const card = await this.prisma.savedCard.findUnique({
            where: { id: cardId },
        });

        if (!card) {
            throw new NotFoundException(`Карта #${cardId} не найдена`);
        }
        if (card.userId !== userId) {
            throw new ForbiddenException('Нет доступа к этой карте');
        }

        await this.prisma.savedCard.delete({ where: { id: cardId } });

        return { message: 'Карта удалена' };
    }

    // ─── СТАТИСТИКА КЛИЕНТОВ (для админки) ───────────────────────────────────

    async getClientsStats(adminId: number, search?: string) {
        const where: any = {
            role: { name: 'customer' }, // Только покупатели, не сотрудники
        };

        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                status: true,
                createdAt: true,
                role: { select: { name: true } },
                orders: {
                    where: { status: { not: 'cart' } },
                    select: { totalAmount: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                },
                // Непрочитанные сообщения от клиента (входящие для менеджера)
                chatMessages: {
                    where: {
                        chatWithUserId: adminId,
                        isRead: false,
                    },
                    select: { id: true },
                },
            },
            orderBy: { id: 'asc' },
        });

        return users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            avatarUrl: u.avatarUrl,
            status: u.status,
            createdAt: u.createdAt,
            role: u.role.name,
            ordersCount: u.orders.length,
            totalSpent: u.orders.reduce(
                (sum, o) => sum + Number(o.totalAmount),
                0,
            ),
            lastOrderDate: u.orders[0]?.createdAt ?? null, // orders уже отсортированы desc
            unreadMessagesCount: u.chatMessages.length,
        }));
    }

    // ─── СОТРУДНИКИ (для старшего менеджера) ──────────────────────────────

    async getEmployees(search?: string) {
        const where: any = {
            role: { name: { in: ['foreman', 'worker'] } },
        };

        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
                { username: { contains: search } },
            ];
        }

        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                username: true,
                avatarUrl: true,
                status: true,
                createdAt: true,
                role: { select: { name: true } },
                team: { select: { id: true, name: true } },
                managedTeam: { select: { id: true, name: true } },
            },
            orderBy: { id: 'asc' },
        });

        return users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            username: u.username,
            avatarUrl: u.avatarUrl,
            status: u.status,
            createdAt: u.createdAt,
            roleName: u.role.name,
            isForeman: u.role.name === 'foreman',
            teamName: u.team?.name || u.managedTeam?.name || null,
            teamId: u.team?.id || u.managedTeam?.id || null,
        }));
    }

    // Переключение статуса сотрудника (active / inactive)
    async toggleEmployeeStatus(employeeId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: employeeId } });
        if (!user) throw new NotFoundException('Сотрудник не найден');

        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        await this.prisma.user.update({
            where: { id: employeeId },
            data: { status: newStatus },
        });

        return { id: employeeId, status: newStatus };
    }

    // Удаление сотрудника
    async deleteEmployee(employeeId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: employeeId },
            select: { role: { select: { name: true } } },
        });
        if (!user) throw new NotFoundException('Сотрудник не найден');
        if (!['foreman', 'worker'].includes(user.role.name)) {
            throw new ForbiddenException('Можно удалять только сотрудников');
        }

        await this.prisma.user.delete({ where: { id: employeeId } });
        return { message: 'Сотрудник удалён' };
    }

    // Создание нового сотрудника
    async createEmployee(dto: {
        username: string;
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string;
        roleName: 'foreman' | 'worker';
        teamId?: number;
    }) {
        const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
        if (!role) throw new NotFoundException('Роль не найдена');

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                username: dto.username,
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone || null,
                roleId: role.id,
                teamId: dto.roleName === 'worker' && dto.teamId ? dto.teamId : null,
            },
        });

        return { id: user.id, message: 'Сотрудник создан' };
    }
}
