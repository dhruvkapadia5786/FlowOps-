import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '7d';

  @IsString()
  @IsOptional()
  API_PREFIX = 'api/v1';

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT = 43124;

  @IsString()
  @IsOptional()
  CORS_ORIGIN = 'http://localhost:43125';

  @IsString()
  @IsOptional()
  NODE_ENV = 'development';

  @IsString()
  @IsOptional()
  REDIS_URL = 'redis://127.0.0.1:6379';

  @IsOptional()
  @IsInt()
  @Min(0)
  SIM_STAGE_DELAY_MS = 400;
}

export function validateEnv(config: Record<string, unknown>) {
  const normalized = {
    ...config,
    PORT: config.PORT !== undefined ? Number(config.PORT) : 43124,
    THROTTLE_TTL_MS:
      config.THROTTLE_TTL_MS !== undefined
        ? Number(config.THROTTLE_TTL_MS)
        : undefined,
    THROTTLE_LIMIT:
      config.THROTTLE_LIMIT !== undefined
        ? Number(config.THROTTLE_LIMIT)
        : undefined,
    SIM_STAGE_DELAY_MS:
      config.SIM_STAGE_DELAY_MS !== undefined
        ? Number(config.SIM_STAGE_DELAY_MS)
        : 400,
  };
  const validated = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
