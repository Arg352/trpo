import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
    /**
     * Предустановленный период: week | month | quarter | year
     * Если указаны startDate/endDate — они имеют приоритет.
     */
    @IsOptional()
    @IsString()
    @IsIn(['week', 'month', 'quarter', 'year'])
    period?: 'week' | 'month' | 'quarter' | 'year';

    /** Начало кастомного диапазона (ISO 8601: 2024-01-01) */
    @IsOptional()
    @IsDateString()
    startDate?: string;

    /** Конец кастомного диапазона (ISO 8601: 2024-03-31) */
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
