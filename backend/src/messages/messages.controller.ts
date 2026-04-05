import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    // POST /messages/send — отправить сообщение
    @Post('send')
    send(
        @Request() req: { user: JwtPayload },
        @Body() dto: SendMessageDto,
    ) {
        return this.messagesService.send(req.user.sub, dto);
    }

    // GET /messages/history/:partnerId — история переписки
    @Get('history/:partnerId')
    getHistory(
        @Request() req: { user: JwtPayload },
        @Param('partnerId', ParseIntPipe) partnerId: number,
    ) {
        return this.messagesService.getHistory(req.user.sub, partnerId);
    }

    // PATCH /messages/read/:partnerId — пометить входящие как прочитанные
    @Patch('read/:partnerId')
    markAsRead(
        @Request() req: { user: JwtPayload },
        @Param('partnerId', ParseIntPipe) partnerId: number,
    ) {
        return this.messagesService.markAsRead(req.user.sub, partnerId);
    }
}
