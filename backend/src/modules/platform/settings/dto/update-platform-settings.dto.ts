
import {
  IsBoolean,
  IsEmail,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  platformName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  supportEmail?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  announcement?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({
    require_protocol: true,
    protocols: ['https'],
  })
  @MaxLength(300)
  supportPortalUrl?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  displayAnnouncement?: boolean;
}
