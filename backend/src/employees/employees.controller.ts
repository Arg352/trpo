import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employees (Admin)')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') // Только admin — полный доступ к управлению сотрудниками
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    // ── ЗАДАЧА 1: Список с поиском ──────────────────────────────────────────

    @Get('employees')
    @ApiOperation({
        summary: 'Список сотрудников (admin)',
        description: 'Возвращает пользователей с ролями admin/employee. Поиск по username, имени, email, телефону.',
    })
    findAll(@Query('search') search?: string) {
        return this.employeesService.findAll(search);
    }

    // ── ЗАДАЧА 2: Смена статуса ─────────────────────────────────────────────

    @Patch('employees/:id/status')
    @ApiOperation({ summary: 'Активировать / деактивировать сотрудника (admin)' })
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEmployeeStatusDto,
    ) {
        return this.employeesService.updateStatus(id, dto);
    }

    // ── ЗАДАЧА 3: Создание и редактирование ─────────────────────────────────

    @Post('employees')
    @ApiOperation({
        summary: 'Создать сотрудника (admin)',
        description: 'Создаёт аккаунт с ролью и полномочиями. Пароль хешируется на сервере.',
    })
    create(@Body() dto: CreateEmployeeDto) {
        return this.employeesService.create(dto);
    }

    @Patch('employees/:id')
    @ApiOperation({
        summary: 'Обновить данные и права сотрудника (admin)',
        description: 'responsibilityIds полностью перезаписывает полномочия (delete + create в транзакции).',
    })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateEmployeeDto,
    ) {
        return this.employeesService.update(id, dto);
    }

    // ── ЗАДАЧА 4: Список полномочий ─────────────────────────────────────────

    @Get('responsibilities')
    @ApiOperation({
        summary: 'Все полномочия (admin)',
        description: 'Справочник для динамической отрисовки тумблеров в модалке редактирования сотрудника.',
    })
    findAllResponsibilities() {
        return this.employeesService.findAllResponsibilities();
    }
}
