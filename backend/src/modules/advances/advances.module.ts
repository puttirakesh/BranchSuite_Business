import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../prisma/prisma.module";

import { AdvancesController } from "./advances.controller";
import { AdvancesService } from "./advances.service";

@Module({
  imports: [
    PrismaModule,

    // Required by JwtAuthGuard
    JwtModule.register({}),
  ],

  controllers: [AdvancesController],

  providers: [AdvancesService],

  exports: [AdvancesService],
})
export class AdvancesModule {}
