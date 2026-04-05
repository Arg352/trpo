import { IsIn, IsObject, IsString } from 'class-validator';

export type SettingsCategory = 'security' | 'delivery' | 'integrations' | 'payments';

export class UpdateSettingsDto {
    @IsString()
    @IsIn(['security', 'delivery', 'integrations', 'payments'])
    category: SettingsCategory;

    /**
     * Плоский объект с обновляемыми полями.
     * Пример: { "sdekEnabled": "true", "sdekApiToken": "sk_new_value" }
     * Если значение содержит символы маскировки (•) или не передано — оно пропускается.
     */
    @IsObject()
    values: Record<string, string | boolean | number | null>;
}
