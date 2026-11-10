import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Max, MinLength, IsUUID, IsDateString, IsDefined, ValidateIf } from 'class-validator';
import { MESSAGE_VISIBILITIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../../../support/support-policy';

export { TICKET_PRIORITIES, TICKET_STATUSES };

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ListPlatformTicketsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsIn(['ALL','MINE','UNASSIGNED']) view?: string;
  @IsOptional() @IsUUID('4') assignedToId?: string;
  @IsOptional() @IsIn(['NOT_TRACKED','ON_TRACK','DUE_SOON','OVERDUE','MET']) slaState?: string;
  @IsOptional() @IsIn(['NONE','REQUESTED','ACKNOWLEDGED','RESOLVED']) escalationStatus?: string;
  @IsOptional() @IsIn(['true','false']) unread?: string;
  @IsOptional() @IsDateString({ strict: true }) createdFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) createdTo?: string;
  @IsOptional() @IsDateString({ strict: true }) updatedFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) updatedTo?: string;
  @IsOptional() @IsUUID('4') tenantId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsIn(TICKET_STATUSES) status?: typeof TICKET_STATUSES[number];
  @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: typeof TICKET_PRIORITIES[number];
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) search?: string;
}

// expectedStatus / expectedPriority give clients optimistic concurrency: a stale view yields 409 instead of a silent overwrite.
export class UpdatePlatformTicketStatusDto {
  @IsIn(TICKET_STATUSES) status!: typeof TICKET_STATUSES[number];
  @IsOptional() @IsIn(TICKET_STATUSES) expectedStatus?: typeof TICKET_STATUSES[number];
}
export class UpdatePlatformTicketPriorityDto {
  @IsIn(TICKET_PRIORITIES) priority!: typeof TICKET_PRIORITIES[number];
  @IsOptional() @IsIn(TICKET_PRIORITIES) expectedPriority?: typeof TICKET_PRIORITIES[number];
}
export class CreatePlatformTicketReplyDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(3000) message!: string;
  /** CUSTOMER (default) is delivered to the Business requester; INTERNAL is visible to platform staff only. */
  @IsOptional() @IsIn(MESSAGE_VISIBILITIES) visibility?: typeof MESSAGE_VISIBILITIES[number];
}

export class SupportRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) expectedRevision!: number;
}
export class AssignSupportDto extends SupportRevisionDto {
  @IsDefined() @ValidateIf((_object, value) => value !== null) @IsUUID('4') agentId!: string | null;
}
export class EscalateSupportDto extends SupportRevisionDto {
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
export class ManageEscalationDto extends SupportRevisionDto {
  @IsIn(['ACKNOWLEDGED','RESOLVED']) status!: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(5) @MaxLength(2000) reason?: string;
}
export class ReadSupportDto {
  @Type(() => Number) @IsInt() @Min(1) customerActivityVersion!: number;
}
export class SupportBusinessesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID('4') tenantId?: string;
  @IsOptional() @IsIn(['true','false']) openOnly?: string;
  @IsOptional() @IsIn(['LATEST','NAME','OPEN']) sort?: string;
}
