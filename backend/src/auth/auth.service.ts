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

    const role = await this.prisma.role.findUnique({ where: { id: user.roleId } });
    let permissions: string[] = [];

    if (role?.name === 'admin' || role?.name === 'senior_manager') {
      permissions = ['all'];
    } else {
      permissions = role ? [role.name] : [];
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

  // Запрос восстановления пароля — генерирует временный пароль и отправляет его на email
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Не раскрываем, есть ли такой email в системе
    if (!user) {
      return { message: 'Если этот email зарегистрирован, временный пароль отправлен.' };
    }

    // Генерируем временный пароль (8 символов)
    const tempPassword = crypto.randomBytes(4).toString('hex'); // например: a3f1bc92

    // Хешируем и сохраняем в БД
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Отправляем письмо с временным паролем
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Временный пароль — SmartPicker',
      html: this.buildTempPasswordEmail(user.firstName, tempPassword),
    });

    this.logger.log(`✉️  Временный пароль отправлен на ${user.email}`);

    return { message: 'Временный пароль отправлен на ваш email. Войдите и смените пароль.' };
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

  // HTML-шаблон письма с временным паролем
  private buildTempPasswordEmail(firstName: string, tempPassword: string): string {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Временный пароль — SmartPicker</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;">
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:2px;">SmartPicker</h1>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">WAREHOUSE MANAGEMENT</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a2e;">Здравствуйте, ${firstName}!</h2>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
                Был создан временный пароль для вашей учётной записи в <strong>SmartPicker</strong>.
              </p>
              <div style="background:#f0f7ff;border:2px solid #3b82f6;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
                <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Ваш временный пароль:</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#1e40af;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
              </div>
              <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;">
                ⚠️ Войдите с этим паролем и смените его на собственный в настройках профиля.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #eee;padding:16px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">© 2025 SmartPicker · Складская система</p>
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

