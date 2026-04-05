import { IsNotEmpty, IsString } from 'class-validator';

export class SendAdminMessageDto {
    @IsString()
    @IsNotEmpty({ message: 'Текст сообщения не может быть пустым' })
    text: string;
}
