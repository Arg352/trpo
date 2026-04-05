import { Module } from '@nestjs/common';
import { AdminChatController } from './admin-chat.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
    controllers: [MessagesController, AdminChatController],
    providers: [MessagesService],
    exports: [MessagesService],
})
export class MessagesModule { }
