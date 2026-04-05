import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Получаем список требуемых ролей из декоратора @Roles(...)
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Если @Roles не указан — роут открыт (не проверяем роль)
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const jwtUser = request.user as JwtPayload;

        // Получаем актуальную роль пользователя из БД (не из токена — он может устареть)
        const user = await this.prisma.user.findUnique({
            where: { id: jwtUser.sub },
            select: { role: { select: { name: true } } },
        });

        if (!user) {
            throw new ForbiddenException('Пользователь не найден');
        }

        const hasRole = requiredRoles.includes(user.role.name);
        if (!hasRole) {
            throw new ForbiddenException('Недостаточно прав для выполнения этого действия');
        }

        return true;
    }
}
