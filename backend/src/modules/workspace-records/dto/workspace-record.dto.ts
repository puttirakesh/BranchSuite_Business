import { ManualText } from '../../../common/validation/manual-text';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class CreateEmployeeDocumentDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') employeeId!: string;
  @ManualText() @IsString() @Length(2, 180) title!: string;
  @IsIn(['LETTER', 'VERIFICATION', 'OTHER']) kind!: string;
  @ManualText() @IsOptional() @IsString() @Length(1, 20000) content?: string;
  @ManualText() @IsOptional() @IsString() @Length(1, 255) fileName?: string;
  @ManualText() @IsOptional() @IsString() @IsIn(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain']) mimeType?: string;
  @IsOptional() @IsString() @MaxLength(7_000_000) fileDataBase64?: string;
}

export class SetWorkspacePreferenceDto {
  @IsUUID('4') companyId!: string;
  @IsIn(['profile', 'workspace', 'crm-lead-draft']) key!: string;
  @IsObject() value!: Record<string, unknown>;
}

export class CreateSupportTicketDto {
  @IsUUID('4') companyId!: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsIn(['ACCOUNT', 'PAYROLL', 'ATTENDANCE', 'CRM', 'OTHER']) category!: string;
  @ManualText() @IsString() @Length(4, 180) subject!: string;
  @ManualText() @IsString() @Length(10, 10000) message!: string;
}

export class AddSupportMessageDto {
  @ManualText() @IsString() @Length(1, 10000) message!: string;
}

export class UpdateSupportTicketDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) status!: string;
}

export class CreateBillingInvoiceDto {
  @IsUUID('4') companyId!: string;
  @IsOptional() @IsUUID('4') subscriptionId?: string;
  @ManualText() @IsString() @Length(3, 300) description!: string;
  @ManualText() @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: 'Amount must use digits with at most two decimal places' }) amount!: string;
  @ManualText() @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @ManualText() @IsOptional() @IsString() @Length(10, 10) dueDate?: string;
}

export class RecordInvoicePaymentDto {
  @ManualText() @IsString() @Length(2, 300) note!: string;
}

