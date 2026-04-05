import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAttributeDto {
    @IsString()
    @IsNotEmpty({ message: 'Название атрибута не может быть пустым' })
    name: string;

    @IsOptional()
    @IsString()
    unit?: string;
}
