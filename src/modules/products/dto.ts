import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApprovalStatus, OrderStatus } from '../../common/enums';

export class SpecDto {
  @IsString()
  @MaxLength(120)
  label: string;

  @IsString()
  @MaxLength(500)
  value: string;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  dimensions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecDto)
  specifications?: SpecDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ImportProductDto {
  @IsUrl({ require_protocol: true }, { message: 'A valid product URL is required' })
  url: string;
}

export class DecideApprovalDto {
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateProcurementDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number | null;

  @IsOptional()
  @IsDateString()
  requiredByDate?: string | null;
}

export class ReorderProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}

export class MoveProductDto {
  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
