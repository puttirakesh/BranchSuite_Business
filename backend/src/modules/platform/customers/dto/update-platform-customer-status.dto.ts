import { IsIn } from 'class-validator';

export class UpdatePlatformCustomerStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
