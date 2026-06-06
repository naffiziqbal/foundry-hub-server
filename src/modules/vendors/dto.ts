import { PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tradeDiscountPct?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLeadTimeDays?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
