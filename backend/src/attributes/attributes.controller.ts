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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

@Controller('attributes')
export class AttributesController {
    constructor(private readonly attributesService: AttributesService) { }

    // ✅ Публичный — список всех характеристик
    @Get()
    findAll() {
        return this.attributesService.findAll();
    }

    // ✅ Публичный
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.attributesService.findOne(id);
    }

    // 🔒 Только для admin
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    create(@Body() dto: CreateAttributeDto) {
        return this.attributesService.create(dto);
    }

    // 🔒 Только для admin
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAttributeDto,
    ) {
        return this.attributesService.update(id, dto);
    }

    // 🔒 Только для admin
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.attributesService.remove(id);
    }
}
