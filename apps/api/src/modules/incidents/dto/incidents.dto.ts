import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateIncidentDto {
  @IsUUID()
  serviceId!: string;

  @IsUUID()
  environmentId!: string;

  @IsOptional()
  @IsUUID()
  deploymentId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ListIncidentsQuery extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @IsOptional()
  @IsUUID()
  deploymentId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

/** Allowed incident status transitions */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: [
    IncidentStatus.investigating,
    IncidentStatus.mitigated,
    IncidentStatus.resolved,
  ],
  investigating: [
    IncidentStatus.mitigated,
    IncidentStatus.resolved,
    IncidentStatus.open,
  ],
  mitigated: [IncidentStatus.resolved, IncidentStatus.investigating],
  resolved: [IncidentStatus.open, IncidentStatus.investigating],
};
