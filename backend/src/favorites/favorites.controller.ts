import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
    constructor(private readonly favoritesService: FavoritesService) { }

    // GET /favorites — мои избранные товары
    @Get()
    @ApiOperation({ summary: 'Список избранных товаров текущего пользователя' })
    getMyFavorites(@Request() req: { user: JwtPayload }) {
        return this.favoritesService.getMyFavorites(req.user.sub);
    }

    // POST /favorites/toggle/:productId — добавить/убрать из избранного
    @Post('toggle/:productId')
    @ApiOperation({ summary: 'Toggle: добавить или убрать товар из избранного' })
    toggle(
        @Request() req: { user: JwtPayload },
        @Param('productId', ParseIntPipe) productId: number,
    ) {
        return this.favoritesService.toggle(req.user.sub, productId);
    }
}
