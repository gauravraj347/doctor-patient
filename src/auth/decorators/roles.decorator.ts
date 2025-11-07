import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/common';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);