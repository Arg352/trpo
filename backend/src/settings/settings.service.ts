import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Ключи, значения которых маскируются при выдаче ──────────────────────────
const SENSITIVE_KEYS = new Set([
    'sdekApiToken', 'pochtaApiToken', 'stripeApiKey',
    'paypalClientId', 'sbpMerchantId',
    'bitrix24ApiToken', 'amocrmApiToken', '1cApiToken',
]);

const MASK = '••••••••••••'; // символ маскировки

// ─── Значения по умолчанию для каждой категории (первый запуск) ───────────────
const DEFAULTS: Record<string, Record<string, string>> = {
    security: {
        twoFactorAuth:          'false',
        ipWhitelist:            'false',
        dataEncryption:         'true',
        sessionTimeoutMinutes:  '30',
    },
    delivery: {
        sdekEnabled:      'false',
        sdekApiToken:     '',
        pochtaEnabled:    'false',
        pochtaApiToken:   '',
        pickupEnabled:    'true',
    },
    integrations: {
        bitrix24Enabled:    'false',
        bitrix24ApiToken:   '',
        amocrmEnabled:      'false',
        amocrmApiToken:     '',
        '1cEnabled':        'false',
        '1cApiToken':       '',
    },
    payments: {
        stripeEnabled:   'false',
        stripeApiKey:    '',
        paypalEnabled:   'false',
        paypalClientId:  '',
        sbpEnabled:      'false',
        sbpMerchantId:   '',
    },
};

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Вспомогательные ───────────────────────────────────────────────────────

    /** Проверяет, является ли значение маской (не нужно перезаписывать) */
    private isMasked(value: unknown): boolean {
        if (value === null || value === undefined) return true;
        const str = String(value);
        return str === '' || str.includes('•') || str.includes('*');
    }

    /** Маскирует чувствительные значения для GET-ответа */
    private maskValue(key: string, value: string): string {
        if (SENSITIVE_KEYS.has(key) && value && value.length > 0) {
            return MASK;
        }
        return value;
    }

    /** Загружает настройки категории из БД, подставляя дефолты для отсутствующих */
    private async loadCategory(category: string): Promise<Record<string, string>> {
        const rows = await this.prisma.systemSetting.findMany({ where: { category } });
        const result: Record<string, string> = { ...(DEFAULTS[category] ?? {}) };
        for (const row of rows) {
            result[row.key] = row.value;
        }
        return result;
    }

    // ── GET: получить одну категорию ──────────────────────────────────────────

    async getCategory(category: string) {
        const raw = await this.loadCategory(category);

        // Маскируем чувствительные поля
        const masked: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(raw)) {
            masked[key] = this.maskValue(key, value);
        }

        // Для безопасности: добавляем mock-данные мониторинга
        if (category === 'security') {
            masked['monitoring'] = await this.buildSecurityMonitoring();
        }

        return masked;
    }

    /** Mock-данные мониторинга (в реальной системе — запросы к БД) */
    private async buildSecurityMonitoring() {
        // Последний вход: берём самого недавно созданного admin-пользователя
        const lastAdmin = await this.prisma.user.findFirst({
            where: { role: { name: 'admin' } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }).catch(() => null);

        return {
            lastAdminLogin:          lastAdmin?.createdAt ?? null,
            activeSessions:          1,   // заглушка
            failedLoginAttempts24h:  0,   // заглушка
        };
    }

    // ── GET: все категории сразу ──────────────────────────────────────────────

    async getAllSettings() {
        const categories = ['security', 'delivery', 'integrations', 'payments'];
        const result: Record<string, unknown> = {};
        await Promise.all(
            categories.map(async (cat) => {
                result[cat] = await this.getCategory(cat);
            }),
        );
        return result;
    }

    // ── PATCH: частичное обновление категории ─────────────────────────────────

    async updateCategory(category: string, values: Record<string, unknown>) {
        const ops: Promise<unknown>[] = [];

        for (const [key, incoming] of Object.entries(values)) {
            // 1. Пропускаем маскированные / undefined / null значения для чувствительных ключей
            if (SENSITIVE_KEYS.has(key) && this.isMasked(incoming)) {
                continue;
            }

            // 2. Для незащищённых ключей тоже пропускаем undefined
            if (incoming === undefined) continue;

            const strValue = String(incoming);

            // upsert: создаём если нет, обновляем если есть
            ops.push(
                this.prisma.systemSetting.upsert({
                    where:  { category_key: { category, key } },
                    update: { value: strValue },
                    create: { category, key, value: strValue },
                }),
            );
        }

        await Promise.all(ops);

        // Возвращаем актуальное состояние категории (с маскировкой)
        return this.getCategory(category);
    }
}
