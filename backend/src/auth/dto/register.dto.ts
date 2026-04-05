import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MinLength,
} from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty({ message: 'Имя не может быть пустым' })
    firstName: string;

    @IsString()
    @IsNotEmpty({ message: 'Фамилия не может быть пустой' })
    lastName: string;

    @IsEmail({}, { message: 'Некорректный email' })
    email: string;

    @IsString()
    @MinLength(3, { message: 'Логин должен быть не менее 3 символов' })
    @Matches(/^[a-zA-Z0-9_]+$/, {
        message: 'Логин может содержать только латинские буквы, цифры и _',
    })
    username: string;

    @IsString()
    @IsNotEmpty({ message: 'Телефон не может быть пустым' })
    phone: string;

    @IsString()
    @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
    password: string;
}
