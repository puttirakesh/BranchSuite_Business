import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceRecordsController } from './workspace-records.controller';
import { WorkspaceRecordsService } from './workspace-records.service';
import { NotificationsController } from './notifications.controller';

@Module({ imports: [AuthModule], controllers: [WorkspaceRecordsController, NotificationsController], providers: [WorkspaceRecordsService] })
export class WorkspaceRecordsModule {}
