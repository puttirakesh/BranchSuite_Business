import { IsNotEmpty, IsUUID } from 'class-validator';

export class CheckOutDto {
  @IsUUID('4')
  @IsNotEmpty()
  companyId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  branchId!: string;
}
