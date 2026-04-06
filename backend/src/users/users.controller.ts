import {
    Body,
    Controller,
    Get,
    Patch,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    getMe(@Request() req: { user: JwtPayload }) {
        return this.usersService.getMe(req.user.sub);
    }

    @Patch('me')
    updateMe(
        @Request() req: { user: JwtPayload },
        @Body() dto: any,
    ) {
        return this.usersService.updateMe(req.user.sub, dto);
    }
}
