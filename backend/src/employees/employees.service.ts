import * as bcrypt from 'bcrypt';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EMPLOYEE_SELECT = {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    status: true,
    breakStatus: true,
    createdAt: true,
    role: { select: { id: true, name: true, description: true } },
    team: { select: { id: true, name: true } },
    managedTeam: { select: { id: true, name: true } },
} as const;

@Injectable()
export class EmployeesService {
    constructor(private readonly prisma: PrismaService) { }

    // ── ЗАДАЧА 1: Управление персоналом (Старший менеджер) ────────────────────

    async findAll(search?: string) {
        const where: any = {
            role: { name: { in: ['worker', 'foreman'] } },
        };

        if (search) {
            where.OR = [
                { username: { contains: search } },
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
            ];
        }

        return this.prisma.user.findMany({
            where,
            select: EMPLOYEE_SELECT,
            orderBy: { id: 'asc' },
        });
    }

    async updateStatus(id: number, status: string) {
        await this.assertExists(id);
        return this.prisma.user.update({
            where: { id },
            data: { status },
            select: EMPLOYEE_SELECT,
        });
    }

    async create(dto: any) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, { username: dto.username }] },
        });
        if (existing) {
            throw new ConflictException('Пользователь с таким email или username уже существует');
        }

        // Разрешаем roleId: либо напрямую, либо через roleName
        let roleId = dto.roleId;
        if (!roleId && dto.roleName) {
            const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
            if (!role) throw new BadRequestException(`Роль "${dto.roleName}" не найдена`);
            roleId = role.id;
        }
        if (!roleId) throw new BadRequestException('Укажите roleId или roleName');

        const passwordHash = await bcrypt.hash(dto.password, 10);

        return this.prisma.user.create({
            data: {
                username: dto.username,
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                roleId,
                status: 'active',
                breakStatus: 'working',
                teamId: dto.teamId || null,
            },
            select: EMPLOYEE_SELECT,
        });
    }


    async update(id: number, dto: any) {
        const target = await this.prisma.user.findUnique({
            where: { id },
            include: { role: { select: { name: true } } },
        });
        if (!target) throw new NotFoundException(`Сотрудник #${id} не найден`);

        if (target.role.name === 'senior_manager') {
            throw new BadRequestException('Нельзя изменить права старшего менеджера через этот эндпоинт');
        }

        const data: any = {};
        if (dto.firstName !== undefined) data.firstName = dto.firstName;
        if (dto.lastName !== undefined) data.lastName = dto.lastName;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.phone !== undefined) data.phone = dto.phone;
        if (dto.roleId !== undefined) data.roleId = dto.roleId;
        if (dto.teamId !== undefined) data.teamId = dto.teamId;
        if (dto.password !== undefined && dto.password.length > 0) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
        }

        return this.prisma.user.update({
            where: { id },
            data,
            select: EMPLOYEE_SELECT,
        });
    }

    async remove(id: number) {
        await this.assertExists(id);

        const target = await this.prisma.user.findUnique({
            where: { id },
            include: { role: { select: { name: true } } },
        });

        if (target?.role.name === 'senior_manager') {
            throw new BadRequestException('Нельзя удалить старшего менеджера через этот эндпоинт');
        }

        await this.prisma.user.delete({ where: { id } });
        return { message: 'Сотрудник удален' };
    }

    // ── БРИГАДЫ И ПЕРЕРЫВЫ ───────────────────────────────────────────────────

    async requestBreak(workerId: number) {
        return this.prisma.user.update({
            where: { id: workerId },
            data: { breakStatus: 'break_requested' },
            select: EMPLOYEE_SELECT,
        });
    }

    async approveBreak(workerId: number, foremanId: number) {
        // Проверка что foreman действительно бригадир этого рабочего
        const worker = await this.prisma.user.findUnique({
            where: { id: workerId },
            include: { team: true },
        });

        if (!worker) throw new NotFoundException('Сборщик не найден');
        if (worker.team?.foremanId !== foremanId) {
            throw new ForbiddenException('Вы не можете подтвердить перерыв сотруднику из другой бригады');
        }

        const activeOrdersCount = await this.prisma.order.count({
            where: {
                assignedWorkerId: workerId,
                status: { in: ['processing', 'in_progress'] },
            },
        });

        // Если у сотрудника нет активных заказов, он уходит на перерыв мгновенно. 
        // Иначе он доделывает текущие и уходит (статус break_approved)
        const finalStatus = activeOrdersCount === 0 ? 'on_break' : 'break_approved';

        return this.prisma.user.update({
            where: { id: workerId },
            data: { 
                breakStatus: finalStatus,
                breakApprovedById: finalStatus === 'break_approved' ? foremanId : null
            },
            select: EMPLOYEE_SELECT,
        });
    }

    async endBreak(workerId: number) {
        return this.prisma.user.update({
            where: { id: workerId },
            data: { 
                breakStatus: 'working',
                breakApprovedById: null
            },
            select: EMPLOYEE_SELECT,
        });
    }

    // ── Вспомогательный ───────────────────────────────────────────────────────

    private async assertExists(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException(`Сотрудник #${id} не найден`);
    }
}
