import { Module } from "@nestjs/common";
import { PlatformAuthModule } from "./auth/platform-auth.module";
import { PlatformDashboardModule } from "./dashboard/platform-dashboard.module";
import { PlatformCustomersModule } from "./customers/platform-customers.module";
import { PlatformBillingModule } from './billing/platform-billing.module';
import { PlatformSupportModule } from './support/platform-support.module';
import { PlatformAuditModule } from './audit/platform-audit.module';
import { PlatformSettingsModule } from './settings/platform-settings.module';
import { PlatformMarketingModule } from './marketing/platform-marketing.module';

@Module({
  imports: [
    PlatformAuthModule,
    PlatformDashboardModule,
    PlatformCustomersModule,
    PlatformBillingModule,
    PlatformSupportModule,
    PlatformAuditModule,
    PlatformSettingsModule,
    PlatformMarketingModule,
  ],
})

export class PlatformModule {}