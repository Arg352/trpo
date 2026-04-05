import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard) // Все эндпоинты корзины требуют авторизации
export class CartController {
    constructor(private readonly cartService: CartService) { }

    // GET /cart — получить текущую корзину
    @Get()
    getCart(@Request() req: { user: JwtPayload }) {
        return this.cartService.getCart(req.user.sub);
    }

    // POST /cart/add — добавить товар в корзину
    @Post('add')
    addToCart(
        @Request() req: { user: JwtPayload },
        @Body() dto: AddToCartDto,
    ) {
        return this.cartService.addToCart(req.user.sub, dto);
    }

    // DELETE /cart/:productId — удалить товар из корзины
    @Delete(':productId')
    removeFromCart(
        @Request() req: { user: JwtPayload },
        @Param('productId', ParseIntPipe) productId: number,
    ) {
        return this.cartService.removeFromCart(req.user.sub, productId);
    }
}
