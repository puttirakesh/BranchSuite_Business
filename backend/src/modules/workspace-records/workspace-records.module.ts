import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceRecordsController } from './workspace-records.controller';
import { WorkspaceRecordsService } from './workspace-records.service';

@Module({ imports: [AuthModule], controllers: [WorkspaceRecordsController], providers: [WorkspaceRecordsService] })
export class WorkspaceRecordsModule {}
