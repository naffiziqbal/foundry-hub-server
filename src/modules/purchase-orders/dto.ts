import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PurchaseOrderStatus } from '../../common/enums';

export class CreatePurchaseOrderDto {
  @IsUUID()
  vendorId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus)
  status: PurchaseOrderStatus;
}
