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
import { IsOptional, IsUUID } from "class-validator";
import { JwtAuthGuard } from "../auth/gaurds/jwt-auth.guard";
import { PermissionsGuard } from "../auth/gaurds/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DealsService, DealActor } from "./deals.service";
import {
  CreateDealDto,
  UpdateDealDto,
  TransitionDealDto,
} from "./dto/deal.dto";
class ListDealsDto {
  @IsUUID("4") companyId!: string;
  @IsOptional() @IsUUID("4") branchId?: string;
}
interface DealRequest {
  authUser: DealActor;
}
@Controller("deals")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DealsController {
  constructor(private readonly service: DealsService) {}
  @Post()
  @RequirePermissions("crm.manage")
  create(@Req() req: DealRequest, @Body() dto: CreateDealDto) {
    return this.service.create(req.authUser, dto);
  }
  @Get()
  @RequirePermissions("crm.read")
  list(@Req() req: DealRequest, @Query() q: ListDealsDto) {
    return this.service.list(req.authUser, q.companyId, q.branchId);
  }
  @Get("owners")
  @RequirePermissions("crm.read")
  owners(@Req() req: DealRequest, @Query() q: ListDealsDto) {
    return this.service.eligibleOwners(req.authUser, q.companyId, q.branchId);
  }
  @Get(":id/history")
  @RequirePermissions("crm.read")
  history(
    @Req() req: DealRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.service.history(req.authUser, id);
  }
  @Get(":id")
  @RequirePermissions("crm.read")
  get(
    @Req() req: DealRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.service.get(req.authUser, id);
  }
  @Patch(":id")
  @RequirePermissions("crm.manage")
  update(
    @Req() req: DealRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.service.update(req.authUser, id, dto);
  }
  @Post(":id/transition")
  @RequirePermissions("crm.manage")
  transition(
    @Req() req: DealRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: TransitionDealDto,
  ) {
    return this.service.transition(req.authUser, id, dto.stage, dto.lossReason);
  }
}
