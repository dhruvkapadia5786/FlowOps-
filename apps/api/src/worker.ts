import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * BullMQ worker process — same codebase as the API, no HTTP listen.
 * Used by Docker Compose `worker` service.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Worker');
  logger.log('FlowOps worker started (BullMQ processors active)');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
