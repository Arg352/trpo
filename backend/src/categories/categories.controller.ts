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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    // ✅ Публичный — возвращает категории со списком атрибутов для фильтрации
    @Get()
    findAll() {
        return this.categoriesService.findAll();
    }

    // ✅ Публичный — мета-данные фильтров для сайдбара
    @Get(':id/filters')
    @ApiOperation({
        summary: 'Мета-данные фильтров категории (minPrice, maxPrice, атрибуты с уникальными значениями)',
    })
    getCategoryFilters(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.getCategoryFilters(id);
    }

    // ✅ Публичный
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.findOne(id);
    }

    // 🔒 Только для admin
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    create(@Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(dto);
    }

    // 🔒 Только для admin
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoriesService.update(id, dto);
    }

    // 🔒 Только для admin
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.remove(id);
    }
}

