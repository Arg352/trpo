import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // GET /users/admin/clients-stats?search=... — статистика клиентов для админки
    @Get('admin/clients-stats')
    @UseGuards(RolesGuard)
    @Roles('admin', 'employee')
    getClientsStats(
        @Request() req: { user: JwtPayload },
        @Query('search') search?: string,
    ) {
        return this.usersService.getClientsStats(req.user.sub, search);
    }

    // GET /users/admin/employees?search=... — список сотрудников (бригадиры + работники)
    @Get('admin/employees')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    getEmployees(@Query('search') search?: string) {
        return this.usersService.getEmployees(search);
    }

    // PATCH /users/admin/employees/:id/toggle-status — переключить active/inactive
    @Patch('admin/employees/:id/toggle-status')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    toggleEmployeeStatus(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.toggleEmployeeStatus(id);
    }

    // POST /users/admin/employees — создать нового сотрудника
    @Post('admin/employees')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    createEmployee(@Body() dto: any) {
        return this.usersService.createEmployee(dto);
    }

    // DELETE /users/admin/employees/:id — удалить сотрудника
    @Delete('admin/employees/:id')
    @UseGuards(RolesGuard)
    @Roles('senior_manager')
    deleteEmployee(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.deleteEmployee(id);
    }

    // GET /users/me — получить профиль (с publicName и счётчиком избранного)
    @Get('me')
    getMe(@Request() req: { user: JwtPayload }) {
        return this.usersService.getMe(req.user.sub);
    }

    // PATCH /users/me — обновить профиль (firstName, lastName, phone, avatarUrl, publicName)
    @Patch('me')
    updateMe(
        @Request() req: { user: JwtPayload },
        @Body() dto: UpdateProfileDto,
    ) {
        return this.usersService.updateMe(req.user.sub, dto);
    }

    // ─── АДРЕСА ДОСТАВКИ ─────────────────────────────────────────────────────

    // POST /users/me/addresses — добавить адрес
    @Post('me/addresses')
    addAddress(
        @Request() req: { user: JwtPayload },
        @Body() dto: CreateAddressDto,
    ) {
        return this.usersService.addAddress(req.user.sub, dto);
    }

    // DELETE /users/me/addresses/:id — удалить адрес
    @Delete('me/addresses/:id')
    deleteAddress(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.usersService.deleteAddress(req.user.sub, id);
    }

    // ─── СОХРАНЁННЫЕ КАРТЫ ───────────────────────────────────────────────────

    // POST /users/me/cards — добавить карту
    @Post('me/cards')
    addCard(
        @Request() req: { user: JwtPayload },
        @Body() dto: CreateCardDto,
    ) {
        return this.usersService.addCard(req.user.sub, dto);
    }

    // DELETE /users/me/cards/:id — удалить карту
    @Delete('me/cards/:id')
    deleteCard(
        @Request() req: { user: JwtPayload },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.usersService.deleteCard(req.user.sub, id);
    }
}
