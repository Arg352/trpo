import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
    sub: number;       // user id
    email: string;
    roleId: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET as string,
        });
    }

    // Возвращаемые данные кладутся в req.user
    validate(payload: JwtPayload): JwtPayload {
        return {
            sub: payload.sub,
            email: payload.email,
            roleId: payload.roleId,
        };
    }
}
