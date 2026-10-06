import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.enableCors({
    origin: (() => {
      const raw = config.get<string>('CORS_ORIGIN');
      if (!raw || raw === 'true') {
        return true;
      }
      const list = raw.split(',').map((o) => o.trim()).filter(Boolean);
      return list.length <= 1 ? list[0] ?? true : list;
    })(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT') ?? 43124;
  await app.listen(port);
  logger.log(`FlowOps API listening on http://127.0.0.1:${port}/${prefix}`);
}

void bootstrap();
