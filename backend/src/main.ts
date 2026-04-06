import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Отбрасывает поля, которых нет в DTO
      forbidNonWhitelisted: true, // Бросает ошибку если есть лишние поля
      transform: true,       // Автоматически преобразует типы (string -> number)
    }),
  );

  // Swagger документация: http://localhost:5000/api/docs
  const config = new DocumentBuilder()
    .setTitle('Store API')
    .setDescription('Документация для фронтенда и десктоп-приложения')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Включаем CORS, чтобы наш внешний фронтенд мог подключиться
  app.enableCors();

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();


