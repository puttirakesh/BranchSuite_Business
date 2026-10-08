import { IsEmail, IsUUID, MaxLength } from "class-validator";
export class ForgotPasswordDto {
  @IsUUID("4") tenantId!: string;
  @IsEmail() @MaxLength(254) email!: string;
}
