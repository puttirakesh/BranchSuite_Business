
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  // =====================================================
  // 2. EMAIL ADDRESS
  // =====================================================

  @IsEmail()
  email!: string;

  // =====================================================
  // 3. INITIAL PASSWORD
  // =====================================================

  @IsString()
  @MinLength(6)
  password!: string;

  // =====================================================
  // 4. PHONE NUMBER (OPTIONAL)
  // =====================================================

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
