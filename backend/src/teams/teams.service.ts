import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: { name: string; foremanId: number }) {
        // У каждого бригадира может быть только 1 активная бригада
        const existingTeam = await this.prisma.team.findUnique({
            where: { foremanId: dto.foremanId }
        });
        if (existingTeam) {
            throw new BadRequestException('Этот сотрудник уже является бригадиром другой бригады.');
        }

        return this.prisma.team.create({
            data: {
                name: dto.name,
                foremanId: dto.foremanId,
            },
            include: { foreman: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { workers: true } } }
        });
    }

    async findAll() {
        return this.prisma.team.findMany({
            include: {
                foreman: {
                    select: { id: true, firstName: true, lastName: true },
                },
                workers: {
                    select: { id: true, firstName: true, lastName: true, email: true, username: true }
                },
                _count: { select: { workers: true, orders: { where: { status: { notIn: ['packed', 'ready', 'delivered'] } } } } }
            }
        });
    }

    async update(id: number, dto: { name?: string; foremanId?: number }) {
        const team = await this.prisma.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Бригада не найдена');

        if (dto.foremanId && dto.foremanId !== team.foremanId) {
            const existingTeam = await this.prisma.team.findUnique({
                where: { foremanId: dto.foremanId }
            });
            if (existingTeam) {
                throw new BadRequestException('Указанный сотрудник уже бригадир другой бригады.');
            }
        }

        return this.prisma.team.update({
            where: { id },
            data: dto,
            include: { foreman: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { workers: true } } }
        });
    }

    async remove(id: number) {
        const team = await this.prisma.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Бригада не найдена');

        // Отвязываем всех сотрудников от бригады (они не удаляются, просто teamId = null)
        await this.prisma.user.updateMany({
            where: { teamId: id },
            data: { teamId: null }
        });

        // Отвязываем незавершенные заказы (optional)
        await this.prisma.order.updateMany({
            where: { assignedTeamId: id },
            data: { assignedTeamId: null }
        });

        await this.prisma.team.delete({ where: { id } });
        return { message: 'Бригада удалена' };
    }

    async addWorker(teamId: number, workerId: number) {
        const team = await this.prisma.team.findUnique({ where: { id: teamId } });
        if (!team) throw new NotFoundException('Бригада не найдена');

        const worker = await this.prisma.user.findUnique({ where: { id: workerId }, include: { role: true } });
        if (!worker || worker.role.name !== 'worker') {
            throw new BadRequestException('Сотрудник не найден или не является сборщиком');
        }
        if (worker.teamId) {
            throw new BadRequestException('Сборщик уже состоит в бригаде');
        }

        await this.prisma.user.update({
            where: { id: workerId },
            data: { teamId }
        });

        return { message: 'Сборщик добавлен' };
    }

    async removeWorker(teamId: number, workerId: number) {
        const worker = await this.prisma.user.findUnique({ where: { id: workerId } });
        if (!worker || worker.teamId !== teamId) {
            throw new BadRequestException('Сборщик не состоит в этой бригаде');
        }

        await this.prisma.user.update({
            where: { id: workerId },
            data: { teamId: null }
        });

        return { message: 'Сборщик исключен' };
    }
}
