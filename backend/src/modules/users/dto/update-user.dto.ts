import { Matches } from 'class-validator';
import { ManualText, ManualName } from '../../../common/validation/manual-text';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// =====================================================
// UPDATE USER DTO
// =====================================================
//
// Used when a business administrator updates
// an existing user's profile.
//
// SECURITY:
// - tenantId comes from the authenticated JWT.
// - status changes use dedicated endpoints.
// - roles and access are managed separately.
// =====================================================

export class UpdateUserDto {
  // =====================================================
  // 1. USER NAME (OPTIONAL)
  // =====================================================

  @ManualName() @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  // =====================================================
  // 2. EMAIL ADDRESS (OPTIONAL)
  // =====================================================

  @ManualText() @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  // =====================================================
  // 3. PHONE NUMBER (OPTIONAL)
  // =====================================================

  @Matches(/^[0-9]{10}$/, { message: 'Phone number must contain exactly 10 digits' }) @ManualText() @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
