import { IsString, Matches, MaxLength, MinLength } from "class-validator";
export class ResetPasswordDto {
  @IsString() token!: string;
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "Password must contain letters and numbers",
  })
  newPassword!: string;
}
