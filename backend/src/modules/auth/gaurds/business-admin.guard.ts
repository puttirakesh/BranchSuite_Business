
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const roles: string[] = request.authUser?.roles ?? [];

    if (
      !roles.includes('BUSINESS_ADMIN') &&
      !roles.includes('BUSINESS_OWNER')
    ) {
      throw new ForbiddenException(
        'Business administrator access required',
      );
    }

    return true;
  }
}
