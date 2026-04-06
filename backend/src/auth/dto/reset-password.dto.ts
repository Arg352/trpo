import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'Токен не может быть пустым' })
    token: string;

    @IsString()
    @MinLength(6, { message: 'Новый пароль должен быть не менее 6 символов' })
    newPassword: string;
}
