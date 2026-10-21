import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ManualText } from '../../common/validation/manual-text';

export class ListDepartmentsDto {
  @IsUUID('4') companyId!: string;
  @IsOptional() @IsUUID('4') branchId?: string;
}

export class CreateDepartmentDto extends ListDepartmentsDto {
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

export class DepartmentEmployeesDto {
  @IsOptional() @IsUUID('4') branchId?: string;
}
