import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // ✅ Публичный — каталог с фильтрами, сортировкой, пагинацией
  @Get()
  @ApiOperation({ summary: 'Каталог товаров с фильтрами и пагинацией' })
  findAll(@Query() query: GetProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  // ✅ Публичный — акционные товары для главной страницы (где oldPrice != null)
  @Get('promotions')
  @ApiOperation({
    summary: 'Товары со скидкой для блока «Акции» на главной странице',
    description: 'Возвращает до 20 активных товаров с ненулевым oldPrice. Поле discountPercent вычисляется на сервере.',
  })
  findPromotions(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.productsService.findPromotions(parsedLimit);
  }

  // 🔒 Только admin — все товары включая неактивные (для витрины)
  @Get('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Все товары для витрины (admin), включая isActive:false + поиск' })
  findAllAdmin(@Query('search') search?: string) {
    return this.productsService.findAllAdmin(search);
  }

  // 🔒 Только admin — экспорт в CSV
  @Get('admin/products/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  @ApiOperation({ summary: 'Экспорт всех товаров в CSV (admin)' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.productsService.exportCsv();
    res.send(csv);
  }

  // 🔒 Только admin — импорт из CSV (упсерт по SKU)
  @Post('admin/products/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Импорт товаров из CSV (admin)',
    description: 'multipart/form-data, поле "file". Upsert по SKU: если найден — обновляем, нет — создаём с isActive:false.',
  })
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.importCsv(file.buffer);
  }

  // ✅ Публичный
  @Get(':id')
  @ApiOperation({ summary: 'Получить товар по ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  // 🔒 Только для admin
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Создать товар (admin)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // 🔒 Только для admin
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Обновить товар (admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  // 🔒 Только для admin
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Удалить товар (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}


