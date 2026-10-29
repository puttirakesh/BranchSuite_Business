import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ManualText, ManualName } from '../../common/validation/manual-text';

export class ListDepartmentsDto {
  @IsUUID('4') companyId!: string;
  @IsOptional() @IsUUID('4') branchId?: string;
}

export class CreateDepartmentDto extends ListDepartmentsDto {
  @ManualName() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

export class DepartmentEmployeesDto {
  @IsOptional() @IsUUID('4') branchId?: string;
}
