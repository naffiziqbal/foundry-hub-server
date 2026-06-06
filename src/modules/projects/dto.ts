import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../../common/enums';

export class CreateProjectDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number | null;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class AssignClientDto {
  @IsOptional()
  @IsUUID()
  clientId?: string | null;
}
