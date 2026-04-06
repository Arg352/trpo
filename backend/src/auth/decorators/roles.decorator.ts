import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Используй так: @Roles('admin') или @Roles('admin', 'employee')
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
