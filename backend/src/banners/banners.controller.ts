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
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerStatusDto } from './dto/update-banner-status.dto';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
    constructor(private readonly bannersService: BannersService) { }

    // GET /banners — активные баннеры для главной страницы
    @Get()
    @ApiOperation({ summary: 'Получить активные промо-баннеры (публичный)' })
    findActive() {
        return this.bannersService.findActive();
    }

    // POST /banners — создать баннер (admin/employee)
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({ summary: 'Создать промо-баннер (admin/employee)' })
    create(@Body() dto: CreateBannerDto) {
        return this.bannersService.create(dto);
    }

    // PATCH /banners/:id/status — включить/выключить баннер
    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'employee')
    @ApiOperation({ summary: 'Включить или выключить баннер (admin/employee)' })
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateBannerStatusDto,
    ) {
        return this.bannersService.updateStatus(id, dto);
    }

    // DELETE /banners/:id — удалить баннер (только admin)
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Удалить баннер (только admin)' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.bannersService.remove(id);
    }
}
