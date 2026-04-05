import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

// DTO для оприходования / списания остатков
export class UpdateStockDto {
    @IsInt({ message: 'changeAmount должен быть целым числом' })
    @Type(() => Number)
    changeAmount: number; // положительное = приёмка, отрицательное = списание

    @IsString()
    @IsNotEmpty({ message: 'Укажите причину изменения остатка' })
    reason: string; // "Приёмка поставки №А-123" / "Списание брака"
}
