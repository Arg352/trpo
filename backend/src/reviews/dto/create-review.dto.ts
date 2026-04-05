import {
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    Min,
} from 'class-validator';

export class CreateReviewDto {
    @IsInt({ message: 'rating должен быть числом' })
    @Min(1, { message: 'Минимальная оценка — 1' })
    @Max(5, { message: 'Максимальная оценка — 5' })
    rating: number;

    @IsOptional()
    @IsString()
    pros?: string; // Плюсы

    @IsOptional()
    @IsString()
    cons?: string; // Минусы

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true, message: 'Каждый mediaUrl должен быть валидным URL' })
    mediaUrls?: string[];
}
