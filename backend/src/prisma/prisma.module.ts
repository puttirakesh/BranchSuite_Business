import { Global, Injectable, Module } from '@nestjs/common';

@Injectable()
export class PrismaService {}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}