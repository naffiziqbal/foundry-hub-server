import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ScheduleType } from '../../common/enums';

export class CreateScheduleDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsEnum(ScheduleType)
  type: ScheduleType;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(ScheduleType)
  type?: ScheduleType;
}

export class AddScheduleItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class UpdateScheduleItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ReorderItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
