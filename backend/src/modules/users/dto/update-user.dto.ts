
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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  // =====================================================
  // 2. EMAIL ADDRESS (OPTIONAL)
  // =====================================================

  @IsOptional()
  @IsEmail()
  email?: string;

  // =====================================================
  // 3. PHONE NUMBER (OPTIONAL)
  // =====================================================

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
