import { IsIn, IsOptional } from 'class-validator';

/**
 * Both fields are optional: the plan and cycle saved for the tenant are used by
 * default (renewals). Amounts and tenants are NEVER accepted from the client
 * (the global ValidationPipe uses `whitelist`, so extra fields are stripped).
 */
export class CreateOrderDto {
  @IsOptional()
  @IsIn(['starter', 'growth', 'scale'])
  planId?: string;

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingCycle?: string;
}
