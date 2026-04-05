import * as bcrypt from 'bcrypt';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';

// Поля, возвращаемые для карточки сотрудника
const EMPLOYEE_SELECT = {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    avatarUrl: true,
    status: true,
    createdAt: true,
    role: { select: { id: true, name: true, description: true } },
    responsibilities: {
        select: {
            responsibility: {
                select: { id: true, code: true, name: true },
            },
        },
    },
} as const;

@Injectable()
export class EmployeesService {
    constructor(private readonly prisma: PrismaService) { }

    // ── ЗАДАЧА 1: Список с поиском ────────────────────────────────────────────

    async findAll(search?: string) {
        const where: any = {
            role: { name: { in: ['admin', 'employee'] } },
        };

        if (search) {
            where.OR = [
                { username: { contains: search } },
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        return this.prisma.user.findMany({
            where,
            select: EMPLOYEE_SELECT,
            orderBy: { id: 'asc' },
        });
    }

    // ── ЗАДАЧА 2: Смена статуса ───────────────────────────────────────────────

    async updateStatus(id: number, dto: UpdateEmployeeStatusDto) {
        await this.assertExists(id);
        return this.prisma.user.update({
            where: { id },
            data: { status: dto.status },
            select: EMPLOYEE_SELECT,
        });
    }

    // ── ЗАДАЧА 3: Создание сотрудника ─────────────────────────────────────────

    async create(dto: CreateEmployeeDto) {
        // Проверяем уникальность email и username
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, { username: dto.username }] },
        });
        if (existing) {
            throw new ConflictException('Пользователь с таким email или username уже существует');
        }

        // Определяем роль — для admin игнорируем responsibilityIds (суперпользователь)
        const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
        const isAdminRole = role?.name === 'admin';

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const publicName = `${dto.firstName} ${dto.lastName}`;

        return this.prisma.user.create({
            data: {
                username: dto.username,
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                publicName,
                roleId: dto.roleId,
                status: 'active',
                // Для admin права не нужны — у него всегда полный доступ
                responsibilities: (!isAdminRole && dto.responsibilityIds?.length)
                    ? {
                        create: dto.responsibilityIds.map((responsibilityId) => ({ responsibilityId })),
                    }
                    : undefined,
            },
            select: EMPLOYEE_SELECT,
        });
    }

    // ── ЗАДАЧА 3: Обновление сотрудника ──────────────────────────────────────

    async update(id: number, dto: UpdateEmployeeDto) {
        const target = await this.prisma.user.findUnique({
            where: { id },
            include: { role: { select: { name: true } } },
        });
        if (!target) throw new NotFoundException(`Сотрудник #${id} не найден`);

        // Блокируем попытку изменить права администратору
        if (target.role.name === 'admin' && dto.responsibilityIds !== undefined) {
            throw new BadRequestException(
                'Нельзя изменить права администратора — у него всегда полный доступ по умолчанию',
            );
        }

        const data: any = {};
        if (dto.firstName !== undefined) data.firstName = dto.firstName;
        if (dto.lastName !== undefined) data.lastName = dto.lastName;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.phone !== undefined) data.phone = dto.phone;
        if (dto.roleId !== undefined) data.roleId = dto.roleId;
        if (dto.password !== undefined) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
        }
        // Пересчитываем publicName если изменились имя/фамилия
        if (dto.firstName || dto.lastName) {
            const current = await this.prisma.user.findUnique({
                where: { id },
                select: { firstName: true, lastName: true },
            });
            data.publicName = `${dto.firstName ?? current!.firstName} ${dto.lastName ?? current!.lastName}`;
        }

        return this.prisma.$transaction(async (tx) => {
            // Если переданы responsibilityIds — полностью перезаписываем
            if (dto.responsibilityIds !== undefined) {
                await tx.userResponsibility.deleteMany({ where: { userId: id } });

                if (dto.responsibilityIds.length > 0) {
                    await tx.userResponsibility.createMany({
                        data: dto.responsibilityIds.map((responsibilityId) => ({
                            userId: id,
                            responsibilityId,
                        })),
                    });
                }
            }

            return tx.user.update({
                where: { id },
                data,
                select: EMPLOYEE_SELECT,
            });
        });
    }

    // ── ЗАДАЧА 4: Список всех полномочий ──────────────────────────────────────

    async findAllResponsibilities() {
        return this.prisma.responsibility.findMany({
            orderBy: { id: 'asc' },
        });
    }

    // ── Вспомогательный ───────────────────────────────────────────────────────

    private async assertExists(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException(`Сотрудник #${id} не найден`);
    }
}
