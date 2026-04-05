import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    // ── СТАРШИЙ МЕНЕДЖЕР: Управление ────────────────────────────────────────

    @Get()
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Список сотрудников склада (senior_manager)' })
    findAll(@Query('search') search?: string) {
        return this.employeesService.findAll(search);
    }

    @Patch(':id/status')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Активировать / деактивировать сотрудника' })
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { status: string },
    ) {
        return this.employeesService.updateStatus(id, dto.status);
    }

    @Post()
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Создать сборщика или бригадира' })
    create(@Body() dto: any) {
        // Здесь можно было бы использовать DTO для строгой валидации
        return this.employeesService.create(dto);
    }

    @Patch(':id')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Обновить профиль сотрудника (и бригаду)' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: any,
    ) {
        return this.employeesService.update(id, dto);
    }

    @Delete(':id')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Физически удалить сотрудника' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.employeesService.remove(id);
    }

    // ── ПЕРЕРЫВЫ ─────────────────────────────────────────────────────────────

    @Patch('break/request')
    @Roles('worker', 'foreman')
    @ApiOperation({ summary: 'Запросить перерыв' })
    requestBreak(@Request() req: { user: JwtPayload }) {
        return this.employeesService.requestBreak(req.user.sub);
    }

    @Patch('break/end')
    @Roles('worker', 'foreman')
    @ApiOperation({ summary: 'Завершить перерыв' })
    endBreak(@Request() req: { user: JwtPayload }) {
        return this.employeesService.endBreak(req.user.sub);
    }

    @Patch(':workerId/break/approve')
    @Roles('foreman')
    @ApiOperation({ summary: 'Одобрить перерыв сотрудника (бригадир)' })
    approveBreak(
        @Request() req: { user: JwtPayload },
        @Param('workerId', ParseIntPipe) workerId: number,
    ) {
        return this.employeesService.approveBreak(workerId, req.user.sub);
    }
}
