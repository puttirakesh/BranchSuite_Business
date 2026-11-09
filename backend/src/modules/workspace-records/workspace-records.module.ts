import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupportModule } from '../support/support.module';
import { WorkspaceRecordsController } from './workspace-records.controller';
import { WorkspaceRecordsService } from './workspace-records.service';
import { NotificationsController } from './notifications.controller';

@Module({ imports: [AuthModule, SupportModule], controllers: [WorkspaceRecordsController, NotificationsController], providers: [WorkspaceRecordsService] })
export class WorkspaceRecordsModule {}
