import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { User } from "@prisma/client";
import { Request } from "express";
import { Strategy } from "passport-jwt";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { isTokenRevoked } from "../ban.util";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    config.get("internal.jwtSecret");
    super({
      jwtFromRequest: JwtStrategy.extractJWT,
      secretOrKey: config.get("internal.jwtSecret"),
    });
  }

  private static extractJWT(req: Request) {
    if (!req.cookies.access_token) return null;
    return req.cookies.access_token;
  }

  async validate(payload: { sub: string; iat?: number }) {
    const user: User = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (isTokenRevoked(user, payload.iat)) return null;
    return user;
  }
}
