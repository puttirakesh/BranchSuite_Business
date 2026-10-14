
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

import { JwtAuthGuard } from "../auth/gaurds/jwt-auth.guard";

import {
  AdvancesService,
  type AdvanceAuthUser,
} from "./advances.service";

import {
  CreateAdvanceDto,
  ReviewAdvanceDto,
} from "./dto/advances.dto";

interface AuthRequest {
  authUser: AdvanceAuthUser;
}

@Controller("advances")
@UseGuards(JwtAuthGuard)
export class AdvancesController {
  constructor(
    private readonly advances: AdvancesService,
  ) {}

  // Employee: available company/branch contexts
  @Get("my-contexts")
  contexts(@Req() req: AuthRequest) {
    return this.advances.myContexts(
      req.authUser,
    );
  }

  // Employee: own advance requests
  @Get("my")
  mine(@Req() req: AuthRequest) {
    return this.advances.mine(
      req.authUser,
    );
  }

  // Employee: submit request
  @Post()
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateAdvanceDto,
  ) {
    return this.advances.create(
      req.authUser,
      dto,
    );
  }

  // Admin: requests for authorized company/branch
  @Get()
  list(
    @Req() req: AuthRequest,
    @Query(
      "companyId",
      new ParseUUIDPipe({ version: "4" }),
    )
    companyId: string,
    @Query(
      "branchId",
      new ParseUUIDPipe({ version: "4" }),
    )
    branchId: string,
  ) {
    return this.advances.list(
      req.authUser,
      companyId,
      branchId,
    );
  }

  // Admin: approve
  @Patch(":id/approve")
  approve(
    @Req() req: AuthRequest,
    @Param(
      "id",
      new ParseUUIDPipe({ version: "4" }),
    )
    id: string,
    @Body() dto: ReviewAdvanceDto,
  ) {
    return this.advances.approve(
      req.authUser,
      id,
      dto,
    );
  }

  // Admin: reject
  @Patch(":id/reject")
  reject(
    @Req() req: AuthRequest,
    @Param(
      "id",
      new ParseUUIDPipe({ version: "4" }),
    )
    id: string,
    @Body() dto: ReviewAdvanceDto,
  ) {
    return this.advances.reject(
      req.authUser,
      id,
      dto,
    );
  }

  // Employee: cancel own pending request
  @Patch(":id/cancel")
  cancel(
    @Req() req: AuthRequest,
    @Param(
      "id",
      new ParseUUIDPipe({ version: "4" }),
    )
    id: string,
  ) {
    return this.advances.cancel(
      req.authUser,
      id,
    );
  }
}
