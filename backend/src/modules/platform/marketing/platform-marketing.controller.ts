import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import {
  AuthenticatedPlatformUser,
  PlatformJwtGuard,
} from "../auth/guards/platform-jwt.guard";
import { PlatformRolesGuard } from "../auth/guards/platform-roles.guard";
import { PlatformRoles } from "../auth/decorators/platform-roles.decorator";
import {
  CreateMarketingOfferDto,
  ListOffersDto,
  UpdateMarketingOfferDto,
  UpdateOfferStatusDto,
} from "./dto/marketing.dto";
import { PlatformMarketingService } from "./platform-marketing.service";

type PlatformRequest = { platformUser: AuthenticatedPlatformUser };

@Controller("platform/marketing/offers")
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformMarketingController {
  constructor(private readonly service: PlatformMarketingService) {}

  @Get("summary") summary() {
    return this.service.summary();
  }

  @Get() list(@Query() query: ListOffersDto) {
    return this.service.list(query);
  }

  @Get(":id/history") history(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.history(id);
  }

  @Get(":id") detail(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.detail(id);
  }

  @Post() create(
    @Body() dto: CreateMarketingOfferDto,
    @Req() req: PlatformRequest,
  ) {
    return this.service.create(dto, req.platformUser.id);
  }

  @Patch(":id") update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMarketingOfferDto,
    @Req() req: PlatformRequest,
  ) {
    return this.service.update(id, dto, req.platformUser.id);
  }

  @Patch(":id/status") status(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOfferStatusDto,
    @Req() req: PlatformRequest,
  ) {
    return this.service.changeStatus(id, dto, req.platformUser.id);
  }
}
