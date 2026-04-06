import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}

    @Post()
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Создать бригаду' })
    create(@Body() dto: { name: string; foremanId: number }) {
        return this.teamsService.create(dto);
    }

    @Get()
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Получить список всех бригад' })
    findAll() {
        return this.teamsService.findAll();
    }

    @Patch(':id')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Изменить бригаду' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { name?: string; foremanId?: number },
    ) {
        return this.teamsService.update(id, dto);
    }

    @Delete(':id')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Удалить бригаду' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.teamsService.remove(id);
    }

    @Post(':id/workers')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Добавить сборщика в бригаду' })
    addWorker(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { workerId: number },
    ) {
        return this.teamsService.addWorker(id, dto.workerId);
    }

    @Delete(':id/workers/:workerId')
    @Roles('senior_manager')
    @ApiOperation({ summary: 'Исключить сборщика из бригады' })
    removeWorker(
        @Param('id', ParseIntPipe) id: number,
        @Param('workerId', ParseIntPipe) workerId: number,
    ) {
        return this.teamsService.removeWorker(id, workerId);
    }
}
