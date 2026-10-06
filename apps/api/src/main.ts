import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

function resolveCorsOrigin(
  raw: string | undefined,
  nodeEnv: string | undefined,
): boolean | string | string[] {
  const isProd = nodeEnv === 'production';
  if (!raw || raw === '*') {
    if (isProd) {
      throw new Error(
        'CORS_ORIGIN must be an explicit allowlist in production (comma-separated)',
      );
    }
    return true;
  }
  if (raw === 'true') {
    if (isProd) {
      throw new Error('CORS_ORIGIN=true is not allowed in production');
    }
    return true;
  }
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0) {
    if (isProd) {
      throw new Error('CORS_ORIGIN allowlist is empty');
    }
    return true;
  }
  return list.length === 1 ? list[0] : list;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigin(
      config.get<string>('CORS_ORIGIN'),
      config.get<string>('NODE_ENV'),
    ),
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
