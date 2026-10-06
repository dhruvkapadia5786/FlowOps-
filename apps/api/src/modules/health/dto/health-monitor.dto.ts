import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertHealthConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  endpointPath?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  timeoutMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  successThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  failureThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  latencyThresholdMs?: number;
}

export class RunHealthChecksDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;

  /** Force unhealthy probes for demo/testing */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forceUnhealthy?: boolean;

  /** Force high latency above threshold */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forceHighLatency?: boolean;
}
