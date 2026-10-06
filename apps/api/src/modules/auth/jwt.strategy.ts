import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/auth.decorators';

type JwtPayload = {
  sub: string;
  email: string;
  fullName: string;
  orgId?: string;
  /** Present in token for clients; ignored server-side — role comes from DB/cache. */
  role?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      orgId: payload.orgId,
      // Do not trust JWT role claims — OrgContextGuard / RolesGuard load membership.
    };
  }
}
