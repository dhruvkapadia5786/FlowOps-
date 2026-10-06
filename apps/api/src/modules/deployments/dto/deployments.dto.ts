import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { DeploymentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateDeploymentDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  environmentId!: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[A-Za-z0-9._+-]+$/)
  version!: string;

  @IsOptional()
  @IsString()
  commitSha?: string;
}

export class ListDeploymentsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DeploymentStatus)
  status?: DeploymentStatus;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}
