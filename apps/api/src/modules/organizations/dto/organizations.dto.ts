import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  role!: OrgRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole)
  role!: OrgRole;
}
