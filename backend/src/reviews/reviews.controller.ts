import {
    Body,
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
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('products/:productId/reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    // GET /products/:productId/reviews — отзывы товара (публичный)
    @Get()
    @ApiOperation({
        summary: 'Список отзывов к товару с рейтингом и медиа',
        description: 'Возвращает averageRating, reviewCount и массив отзывов. Каждый отзыв содержит pros, cons, media[] и user.publicName.',
    })
    findByProduct(@Param('productId', ParseIntPipe) productId: number) {
        return this.reviewsService.findByProduct(productId);
    }

    // POST /products/:productId/reviews — оставить отзыв (авторизованный)
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Оставить отзыв на товар',
        description: 'Один пользователь — один отзыв на товар. После создания автоматически пересчитывает averageRating и reviewCount.',
    })
    create(
        @Param('productId', ParseIntPipe) productId: number,
        @Request() req: { user: JwtPayload },
        @Body() dto: CreateReviewDto,
    ) {
        return this.reviewsService.create(req.user.sub, productId, dto);
    }
}
