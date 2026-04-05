import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) { }

  // Проверка учётных данных (используется при логине)
  async validateUser(identifier: string, password: string) {
    // Поиск по username ИЛИ email
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    return user;
  }

  // Выдача JWT токена + массив полномочий для сайдбара
  async login(dto: LoginDto): Promise<{ access_token: string; permissions: string[] }> {
    const user = await this.validateUser(dto.login, dto.password);

    // Помечаем пользователя как онлайн
    await this.prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    };

    // Получаем полномочия: admin → все коды; employee → только назначенные
    const role = await this.prisma.role.findUnique({ where: { id: user.roleId } });
    let permissions: string[] = [];

    if (role?.name === 'admin') {
      const all = await this.prisma.responsibility.findMany({ select: { code: true } });
      permissions = all.map((r) => r.code);
    } else {
      const userResp = await this.prisma.userResponsibility.findMany({
        where: { userId: user.id },
        select: { responsibility: { select: { code: true } } },
      });
      permissions = userResp.map((ur) => ur.responsibility.code);
    }

    return {
      access_token: this.jwtService.sign(payload),
      permissions,
    };
  }

  // Выход из системы — помечаем пользователя как оффлайн
  async logout(userId: number) {
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'inactive' } });
    return { message: 'Вы вышли из системы' };
  }

  // Регистрация нового пользователя
  async register(dto: RegisterDto) {
    // 1. Проверяем дублирование email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // 2. Проверяем дублирование username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Этот логин уже занят');
    }

    // 3. Ищем роль 'customer' в базе данных
    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });
    if (!customerRole) {
      throw new NotFoundException('Роль по умолчанию не найдена');
    }

    // 4. Хешируем пароль и создаём пользователя
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        publicName: `${dto.firstName} ${dto.lastName}`,
        roleId: customerRole.id,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        roleId: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  }

  // Запрос сброса пароля — генерирует токен и отправляет письмо на email
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Не раскрываем, есть ли такой email в системе (защита от перебора)
    if (!user) {
      return { message: 'Если этот email зарегистрирован, письмо с инструкциями отправлено.' };
    }

    // Генерируем случайный токен (32 байта = 64 символа hex)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Хешируем токен перед сохранением в БД (защита от утечки данных)
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Срок действия — 1 час
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: expiry,
      },
    });

    const resetLink = `http://localhost:3000/reset-password?token=${rawToken}`;

    // Отправляем реальное письмо через SMTP
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Сброс пароля в GGG Store',
      html: this.buildResetPasswordEmail(user.firstName, resetLink),
    });

    this.logger.log(`✉️  Письмо для сброса пароля отправлено на ${user.email}`);

    return { message: 'Если этот email зарегистрирован, письмо с инструкциями отправлено.' };
  }

  // Сброс пароля по токену
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Хешируем входящий токен для сравнения с БД
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: tokenHash },
    });

    if (!user) {
      throw new BadRequestException('Токен недействителен или уже использован');
    }

    // Проверяем, не истёк ли срок действия токена
    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('Срок действия ссылки для сброса пароля истёк. Запросите новую.');
    }

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Обновляем пароль и очищаем токен
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    this.logger.log(`🔑 Пароль успешно сброшен для пользователя: ${user.email}`);

    return { message: 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.' };
  }

  // HTML-шаблон письма для сброса пароля
  private buildResetPasswordEmail(firstName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Сброс пароля — GGG Store</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Шапка -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#4a00e0,#3b00b8);padding:36px 40px;">
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:4px;">GGG</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:1px;">STORE</p>
            </td>
          </tr>

          <!-- Тело -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a2e;font-weight:700;">Здравствуйте, ${firstName}!</h2>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
                Мы получили запрос на сброс пароля для вашей учётной записи в&nbsp;<strong>GGG Store</strong>.
                Нажмите на кнопку ниже, чтобы задать новый пароль.
              </p>

              <!-- Кнопка -->
              <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#4a00e0,#7b2ff7);border-radius:8px;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">
                      Сбросить пароль
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Предупреждение -->
              <div style="background:#f8f4ff;border-left:4px solid #7b2ff7;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">
                  ⏱&nbsp;<strong>Ссылка действительна 1 час</strong> с момента получения письма.
                  Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
                </p>
              </div>

              <!-- Резервная ссылка -->
              <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
                Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br/>
                <a href="${resetLink}" style="color:#7b2ff7;word-break:break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- Подвал -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                © 2024 GGG Store · Казань, ул. Большая Белая, 75, 41345
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
