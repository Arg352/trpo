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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SendAdminMessageDto } from './dto/send-admin-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('Admin Chat')
@Controller('admin/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'employee')
export class AdminChatController {
    constructor(private readonly messagesService: MessagesService) { }

    // GET /admin/chat/:clientId — история переписки + пометить входящие как прочитанные
    @Get(':clientId')
    @ApiOperation({
        summary: 'История чата с клиентом (admin/employee)',
        description: 'Возвращает историю переписки и помечает входящие сообщения от клиента как isRead:true.',
    })
    async getChat(
        @Param('clientId', ParseIntPipe) clientId: number,
        @Request() req: { user: JwtPayload },
    ) {
        const adminId = req.user.sub;

        // Сначала помечаем сообщения клиента как прочитанные
        await this.messagesService.markAsRead(adminId, clientId);

        // Затем возвращаем полную историю
        return this.messagesService.getHistory(adminId, clientId);
    }

    // POST /admin/chat/:clientId — отправить сообщение клиенту
    @Post(':clientId')
    @ApiOperation({
        summary: 'Отправить сообщение клиенту (admin/employee)',
        description: 'Создаёт ChatMessage: userId = текущий менеджер, chatWithUserId = clientId.',
    })
    sendMessage(
        @Param('clientId', ParseIntPipe) clientId: number,
        @Request() req: { user: JwtPayload },
        @Body() dto: SendAdminMessageDto,
    ) {
        // Отправитель — менеджер, получатель — клиент
        return this.messagesService.send(req.user.sub, {
            receiverId: clientId,
            text: dto.text,
        });
    }
}
