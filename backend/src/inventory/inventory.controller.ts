import {
    Body,
    Controller,
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
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory (Admin)')
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    // GET /admin/inventory?search=iPhone — список всех товаров склада
    @Get()
    @ApiOperation({
        summary: 'Список товаров склада (admin/employee)',
        description: 'Все товары включая isActive:false. Поле isLow = true если stockQuantity <= minStockLevel.',
    })
    findAll(@Query('search') search?: string) {
        return this.inventoryService.findAll(search);
    }

    // POST /admin/inventory — завести товар на склад (черновик)
    @Post()
    @ApiOperation({
        summary: 'Завести новый товар на склад (admin/employee)',
        description: 'Создаёт товар с isActive: false. Для публикации на сайте нужно заполнить карточку в "Управлении товарами".',
    })
    create(@Body() dto: CreateInventoryItemDto) {
        return this.inventoryService.create(dto);
    }

    // PATCH /admin/inventory/:productId — оприходование / списание
    @Patch(':productId')
    @ApiOperation({
        summary: 'Изменить остаток товара (admin/employee)',
        description: 'changeAmount: положительное = приёмка, отрицательное = списание. Создаёт запись InventoryLog с userId.',
    })
    updateStock(
        @Param('productId', ParseIntPipe) productId: number,
        @Request() req: { user: JwtPayload },
        @Body() dto: UpdateStockDto,
    ) {
        return this.inventoryService.updateStock(productId, req.user.sub, dto);
    }
}
