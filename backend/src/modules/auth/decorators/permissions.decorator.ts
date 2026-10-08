import { SetMetadata } from "@nestjs/common";
export const REQUIRED_PERMISSION = "branchsuite:permission";
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
