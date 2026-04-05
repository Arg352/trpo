import { Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsEmail,
    IsInt,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class UpdateEmployeeDto {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    roleId?: number;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Type(() => Number)
    responsibilityIds?: number[]; // Полностью перезаписывает права
}
