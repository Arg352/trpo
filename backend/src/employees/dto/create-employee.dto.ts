import { Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6, { message: 'Пароль не менее 6 символов' })
    password: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsInt()
    @Type(() => Number)
    roleId: number; // ID роли (admin или employee)

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Type(() => Number)
    responsibilityIds?: number[]; // Массив ID полномочий
}
