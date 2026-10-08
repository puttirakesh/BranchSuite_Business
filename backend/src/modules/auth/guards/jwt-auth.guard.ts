import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../../prisma/prisma.service";

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: {
    id: string;
    tenantId: string;
    sid: string;
    portal: "BUSINESS" | "EMPLOYEE";
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        tenantId: string;
        sid: string;
        portal: "BUSINESS" | "EMPLOYEE";
      }>(token);
      const session = await this.prisma.authSession.findUnique({
        where: { id: payload.sid },
        include: { user: { include: { tenant: true } } },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.userId !== payload.sub ||
        session.portal !== payload.portal ||
        session.user.status !== "ACTIVE" ||
        session.user.tenantId !== payload.tenantId ||
        session.user.tenant?.status !== "ACTIVE"
      )
        throw new Error("Invalid session");
      req.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        sid: payload.sid,
        portal: payload.portal,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Session invalid or expired");
    }
  }
}
