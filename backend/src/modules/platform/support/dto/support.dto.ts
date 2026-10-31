import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Max, MinLength, IsUUID } from 'class-validator';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class ListPlatformTicketsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsUUID('4') tenantId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsIn(TICKET_STATUSES) status?: typeof TICKET_STATUSES[number];
  @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: typeof TICKET_PRIORITIES[number];
  @IsOptional() @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(100) search?: string;
}

export class UpdatePlatformTicketStatusDto {
  @IsIn(TICKET_STATUSES) status!: typeof TICKET_STATUSES[number];
}
export class UpdatePlatformTicketPriorityDto {
  @IsIn(TICKET_PRIORITIES) priority!: typeof TICKET_PRIORITIES[number];
}
export class CreatePlatformTicketReplyDto {
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(3000) message!: string;
}
