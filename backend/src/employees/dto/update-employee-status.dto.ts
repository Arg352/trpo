import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateEmployeeStatusDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(['active', 'inactive'], { message: 'status должен быть "active" или "inactive"' })
    status: 'active' | 'inactive';
}
