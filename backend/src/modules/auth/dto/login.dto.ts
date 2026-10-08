
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsIn(['staff', 'employee'])
  portal!: 'staff' | 'employee';

  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
