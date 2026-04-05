import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateBannerStatusDto {
    @ApiProperty({ description: 'Активен ли баннер', example: true })
    @IsBoolean({ message: 'isActive должен быть boolean' })
    isActive: boolean;
}
