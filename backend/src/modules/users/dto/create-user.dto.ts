import { Matches } from 'class-validator';
import { ManualText } from '../../../common/validation/manual-text';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// =====================================================
// CREATE USER DTO
// =====================================================
//
// Used when a business administrator creates
// a new staff/user account.
//
// SECURITY:
// - tenantId must come from the authenticated JWT.
// - status must be controlled by the backend.
// - roles and access are managed separately.
// =====================================================

export class CreateUserDto {
  // =====================================================
  // 1. USER NAME
  // =====================================================

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  // =====================================================
  // 2. EMAIL ADDRESS
  // =====================================================

  @IsEmail()
  @MaxLength(254)
  email!: string;

  // =====================================================
  // 3. INITIAL PASSWORD
  // =====================================================

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // =====================================================
  // 4. PHONE NUMBER (OPTIONAL)
  // =====================================================

  @Matches(/^[0-9]{10}$/, { message: 'Phone number must contain exactly 10 digits' }) @ManualText() @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
