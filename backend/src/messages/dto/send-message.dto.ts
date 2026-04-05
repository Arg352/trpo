import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
    @IsInt({ message: 'receiverId должен быть числом' })
    receiverId: number;

    @IsString()
    @IsNotEmpty({ message: 'Текст сообщения не может быть пустым' })
    text: string;
}
