
import { Equals } from 'class-validator';

export class AssignRoleDto {
  @Equals('EMPLOYEE')
  role!: 'EMPLOYEE';
}
