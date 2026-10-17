import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";

import { PrismaModule } from "../../prisma/prisma.module";

import { AdvancesController } from "./advances.controller";
import { AdvancesService } from "./advances.service";

@Module({
  imports: [
    PrismaModule,

    // Required by JwtAuthGuard
    AuthModule,
  ],

  controllers: [AdvancesController],

  providers: [AdvancesService],

  exports: [AdvancesService],
})
export class AdvancesModule {}
