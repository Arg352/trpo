import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
    imports: [PrismaModule],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService], // экспортируем на случай если другим модулям понадобится читать настройки
})
export class SettingsModule { }
