import { ManualText } from '../../../common/validation/manual-text';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
export enum DealStage {
  DISCOVERY = "DISCOVERY",
  QUALIFIED = "QUALIFIED",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
}
export class CreateDealDto {
  @IsUUID("4") companyId!: string;
  @IsOptional() @IsUUID("4") branchId?: string;
  @IsOptional() @IsUUID("4") leadId?: string;
  @IsOptional() @IsUUID("4") customerId?: string;
  @IsOptional() @IsUUID("4") ownerId?: string;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/) amount?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsISO8601() expectedCloseAt?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(3000) notes?: string;
}
export class UpdateDealDto {
  @ManualText() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/) amount?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsISO8601() expectedCloseAt?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @IsUUID("4") leadId?: string;
  @IsOptional() @IsUUID("4") customerId?: string;
  @IsOptional() @IsUUID("4") ownerId?: string;
}
export class TransitionDealDto {
  @IsEnum(DealStage) stage!: DealStage;
  @ManualText() @ValidateIf((o) => o.stage === DealStage.LOST)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  lossReason?: string;
}
