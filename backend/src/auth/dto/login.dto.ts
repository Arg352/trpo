import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsNotEmpty({ message: 'Укажите email или логин' })
    login: string; // Принимает и username, и email

    @IsString()
    @IsNotEmpty({ message: 'Пароль не может быть пустым' })
    password: string;
}
