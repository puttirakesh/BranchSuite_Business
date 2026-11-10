import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_SUBSCRIPTION_KEY = 'allowPendingSubscription';

export const AllowPendingSubscription = () =>
  SetMetadata(ALLOW_PENDING_SUBSCRIPTION_KEY, true);
