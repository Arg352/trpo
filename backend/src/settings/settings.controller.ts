import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

const CATEGORY_DESC = 'Категория настроек: security | delivery | integrations | payments';

@ApiTags('Settings (Admin)')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    /**
     * GET /admin/settings — все категории одним запросом (для первичной загрузки)
     */
    @Get()
    @ApiOperation({
        summary: 'Получить все настройки системы (admin)',
        description: 'Возвращает все 4 категории настроек одним объектом. Чувствительные поля (токены, ключи) возвращаются в маскированном виде (••••••••••••).',
    })
    @ApiResponse({
        status: 200,
        description: 'Полный объект настроек',
        schema: {
            example: {
                security:     { twoFactorAuth: 'false', sessionTimeoutMinutes: '30', monitoring: {} },
                delivery:     { sdekEnabled: 'false', sdekApiToken: '••••••••••••' },
                integrations: { bitrix24Enabled: 'false', bitrix24ApiToken: '••••••••••••' },
                payments:     { stripeEnabled: 'true', stripeApiKey: '••••••••••••' },
            },
        },
    })
    getAll() {
        return this.settingsService.getAllSettings();
    }

    /**
     * GET /admin/settings/:category — настройки одной вкладки
     */
    @Get(':category')
    @ApiOperation({
        summary: 'Получить настройки одной категории (admin)',
        description: CATEGORY_DESC,
    })
    @ApiParam({ name: 'category', enum: ['security', 'delivery', 'integrations', 'payments'] })
    @ApiResponse({ status: 200, description: 'Настройки категории с маскированными секретами' })
    getCategory(@Param('category') category: string) {
        return this.settingsService.getCategory(category);
    }

    /**
     * PATCH /admin/settings/:category — частичное обновление
     *
     * Защита от «Masked Keys Trap»:
     * - Если значение поля содержит символы маскировки (•) или равно null/undefined —
     *   это поле в БД НЕ перезаписывается.
     * - Только ключи, присутствующие в body, затрагиваются (строгий partial update).
     */
    @Patch(':category')
    @ApiOperation({
        summary: 'Обновить настройки категории (admin, partial)',
        description:
            'Частичное обновление: только переданные ключи изменяются в БД. ' +
            'Чувствительные значения (токены, ключи) игнорируются если содержат символы маскировки — ' +
            'это защита от случайной перезаписи при отправке маски обратно.',
    })
    @ApiParam({ name: 'category', enum: ['security', 'delivery', 'integrations', 'payments'] })
    @ApiBody({
        description: 'Плоский объект с обновляемыми полями',
        schema: {
            example: {
                sdekEnabled:  'true',
                sdekApiToken: 'sk_cdek_NEW_REAL_TOKEN',  // передаётся только при реальном изменении
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Актуальные настройки после обновления (с маскировкой)' })
    updateCategory(
        @Param('category') category: string,
        @Body() dto: UpdateSettingsDto,
    ) {
        return this.settingsService.updateCategory(category, dto.values);
    }
}
