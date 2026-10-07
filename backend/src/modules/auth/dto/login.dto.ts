import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { LoginType } from '../enums/login-type.enum';

export class LoginDto {
  @IsEnum(LoginType, {
    message: 'loginType must be BUSINESS or EMPLOYEE',
  })
  loginType!: LoginType;

  @IsNotEmpty({
    message: 'Business is required',
  })
  @IsUUID('4', {
    message: 'Invalid business id',
  })
  tenantId!: string;

  @IsNotEmpty({
    message: 'Email is required',
  })
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address',
    },
  )
  email!: string;

  @IsNotEmpty({
    message: 'Password is required',
  })
  @IsString()
  @MinLength(6, {
    message: 'Password must contain at least 6 characters',
  })
  password!: string;
}