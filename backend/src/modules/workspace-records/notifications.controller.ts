import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';

type Request = { authUser: { id: string; tenantId: string; companyId?: string } };
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async mine(@Req() req: Request) {
    const user = req.authUser;
    const grants = await this.prisma.userCompanyAccess.findMany({ where: { userId: user.id }, select: { companyId: true } });
    return this.prisma.notification.findMany({ where: { tenantId: user.tenantId, userId: user.id,
      companyId: user.companyId ? { equals: user.companyId, in: grants.map(item => item.companyId) } : { in: grants.map(item => item.companyId) },
    }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  }
  @Patch(':id/read')
  read(@Req() req: Request, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.prisma.notification.updateMany({ where: { id, tenantId: req.authUser.tenantId, userId: req.authUser.id, readAt: null }, data: { readAt: new Date() } });
  }
}
