import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
    constructor(private readonly prisma: PrismaService) { }

    // Отправить сообщение
    async send(senderId: number, dto: SendMessageDto) {
        // Проверяем, что получатель существует
        const receiver = await this.prisma.user.findUnique({
            where: { id: dto.receiverId },
        });
        if (!receiver) {
            throw new NotFoundException(`Пользователь с id=${dto.receiverId} не найден`);
        }

        return this.prisma.chatMessage.create({
            data: {
                userId: senderId,
                chatWithUserId: dto.receiverId,
                text: dto.text,
            },
            select: {
                id: true,
                userId: true,
                chatWithUserId: true,
                text: true,
                isRead: true,
                createdAt: true,
            },
        });
    }

    // История переписки с конкретным пользователем
    async getHistory(myId: number, partnerId: number) {
        return this.prisma.chatMessage.findMany({
            where: {
                OR: [
                    { userId: myId, chatWithUserId: partnerId },
                    { userId: partnerId, chatWithUserId: myId },
                ],
            },
            select: {
                id: true,
                userId: true,
                chatWithUserId: true,
                text: true,
                isRead: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    // Пометить входящие сообщения от partnerId как прочитанные
    async markAsRead(myId: number, partnerId: number) {
        const result = await this.prisma.chatMessage.updateMany({
            where: {
                userId: partnerId,        // отправитель — партнёр
                chatWithUserId: myId,     // получатель — я
                isRead: false,
            },
            data: { isRead: true },
        });

        return { markedAsRead: result.count };
    }
}
