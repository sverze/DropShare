import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as argon from "argon2";
import { Request, Response } from "express";
import * as moment from "moment";
import { ConfigService } from "src/config/config.service";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import { OAuthService } from "../oauth/oauth.service";
import { GenericOidcProvider } from "../oauth/provider/genericOidc.provider";
import { UserSevice } from "../user/user.service";
import { UserDTO } from "../user/dto/user.dto";
import { banMessage, isTokenRevoked, isUserBanned } from "./ban.util";
import { AuthRegisterDTO } from "./dto/authRegister.dto";
import { AuthSignInDTO } from "./dto/authSignIn.dto";
import { LdapService } from "./ldap.service";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const dots = "•".repeat(Math.min(Math.max(local.length - 1, 1), 3));
  return `${local.slice(0, 1)}${dots}@${domain}`;
}

function hasRealEmail(email?: string | null): boolean {
  return !!email && !email.toLowerCase().endsWith("@ldap.local");
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private ldapService: LdapService,
    private userService: UserSevice,
    @Inject(forwardRef(() => OAuthService)) private oAuthService: OAuthService,
  ) {}
  private readonly logger = new Logger(AuthService.name);

  async signUp(dto: AuthRegisterDTO, ip: string, isAdmin?: boolean) {
    const isFirstUser = (await this.prisma.user.count()) == 0;
    const isDropShareSignup = true;
    const requireInviteCode =
      !isFirstUser &&
      isDropShareSignup &&
      this.config.get("share.requireInviteCodeForRegistration");

    const hash = dto.password ? await argon.hash(dto.password) : null;

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        let consumedInviteCode:
          | Awaited<ReturnType<UserSevice["consumeInviteCode"]>>
          | null = null;

        if (dto.inviteCode?.trim()) {
          consumedInviteCode = await this.userService.consumeInviteCode(
            dto.inviteCode,
            tx,
          );
        }

        const createdUser = await tx.user.create({
          data: {
            email: dto.email,
            username: dto.username,
            password: hash,
            isAdmin: isAdmin ?? isFirstUser,
            role: (isAdmin ?? isFirstUser) ? "admin" : "user",
            // The first user becomes the protected owner account: other admins
            // can't delete, ban, demote, or edit it. They can grant the same
            // protection to further accounts once signed in.
            protected: isFirstUser,
            canCreateShares:
              isFirstUser ||
              !!consumedInviteCode ||
              (isDropShareSignup && !requireInviteCode),
          },
        });

        if (consumedInviteCode?.groupId) {
          await tx.userGroupMembership.create({
            data: {
              userId: createdUser.id,
              groupId: consumedInviteCode.groupId,
              role: "member",
            },
          });
        }

        return createdUser;
      });

      const { refreshToken, refreshTokenId } = await this.createRefreshToken(
        user.id,
      );
      const accessToken = await this.createAccessToken(user, refreshTokenId);

      this.logger.log(`User ${user.email} signed up from IP ${ip}`);
      
      // Whitelist through UserDTO rather than spreading the Prisma row. The
      // spread version was named "sanitized" but only converted BigInts, so
      // the signup response carried the argon2 password hash, the TOTP secret
      // and the LDAP DN back to the client.
      const sanitizedUser = new UserDTO().from(user);

      return { accessToken, refreshToken, user: sanitizedUser };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }

      throw e;
    }
  }

  async signIn(dto: AuthSignInDTO, ip: string) {
    if (!dto.email && !dto.username) {
      throw new BadRequestException("Email or username is required");
    }

    if (!this.config.get("oauth.disablePassword")) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: dto.email }, { username: dto.username }],
        },
      });

      if (user?.password && (await argon.verify(user.password, dto.password))) {
        this.logger.log(
          `Successful password login for user ${user.email} from IP ${ip}`,
        );
        return this.generateToken(user);
      }
    }

    if (this.config.get("ldap.enabled")) {
      const ldapUsername = dto.username || dto.email;
      this.logger.debug(`Trying LDAP login for user ${ldapUsername}`);
      const ldapUser = await this.ldapService.authenticateUser(
        ldapUsername,
        dto.password,
      );
      if (ldapUser) {
        const user = await this.userService.findOrCreateFromLDAP(dto, ldapUser);
        this.logger.log(
          `Successful LDAP login for user ${ldapUsername} (${user.id}) from IP ${ip}`,
        );
        return this.generateToken(user);
      }
    }

    this.logger.log(
      `Failed login attempt for user ${dto.email || dto.username} from IP ${ip}`,
    );
    throw new UnauthorizedException("Wrong email or password");
  }

  async generateToken(user: User, oauth?: { idToken?: string }) {
    if (isUserBanned(user)) {
      throw new ForbiddenException(banMessage(user));
    }

    if (user.totpVerified && !(oauth && this.config.get("oauth.ignoreTotp"))) {
      const loginToken = await this.createLoginToken(user.id);

      return { loginToken, verificationMethod: "totp" as const };
    }

    if (
      !oauth &&
      !!this.config.get("email.loginVerification") &&
      !!this.config.get("smtp.enabled") &&
      hasRealEmail(user.email)
    ) {
      const loginToken = await this.createEmailCodeChallenge(user);
      return {
        loginToken,
        verificationMethod: "email" as const,
        emailHint: maskEmail(user.email),
      };
    }

    const { refreshToken, refreshTokenId } = await this.createRefreshToken(
      user.id,
      oauth?.idToken,
    );
    const accessToken = await this.createAccessToken(user, refreshTokenId);

    return { accessToken, refreshToken };
  }

  private generateSixDigitCode(): string {
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  }

  private async createEmailCodeChallenge(user: User): Promise<string> {
    const now = new Date();

    const existing = await this.prisma.loginToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        emailCodeHash: { not: null },
        expiresAt: { gt: now },
        emailCodeAttempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing.token;

    const recentCodes = await this.prisma.loginToken.count({
      where: {
        userId: user.id,
        emailCodeHash: { not: null },
        createdAt: { gte: moment().subtract(1, "hour").toDate() },
      },
    });
    if (recentCodes >= 10) {
      throw new BadRequestException(
        "Too many sign-in attempts. Please try again later.",
      );
    }

    const code = this.generateSixDigitCode();
    const emailCodeHash = await argon.hash(code);
    const { token } = await this.prisma.loginToken.create({
      data: {
        userId: user.id,
        expiresAt: moment().add(10, "minutes").toDate(),
        emailCodeHash,
      },
    });

    try {
      await this.emailService.sendLoginCode(user.email, { code });
    } catch (e) {
      this.logger.error(`Failed to send login code to ${user.email}: ${e}`);
      await this.prisma.loginToken
        .delete({ where: { token } })
        .catch(() => undefined);
      throw new InternalServerErrorException(
        "We couldn't send your sign-in code. Please try again in a moment.",
      );
    }

    return token;
  }

  async signInEmailCode(dto: { loginToken: string; code: string }) {
    const now = new Date();

    const claimed = await this.prisma.loginToken.updateMany({
      where: {
        token: dto.loginToken,
        used: false,
        emailCodeHash: { not: null },
        expiresAt: { gt: now },
        emailCodeAttempts: { lt: 5 },
      },
      data: { emailCodeAttempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    const token = await this.prisma.loginToken.findFirst({
      where: { token: dto.loginToken },
      include: { user: true },
    });
    if (!token || !token.emailCodeHash) {
      throw new UnauthorizedException("Invalid login token");
    }

    const valid = await argon.verify(token.emailCodeHash, dto.code);
    if (!valid) {
      throw new BadRequestException("Invalid code");
    }

    if (isUserBanned(token.user)) {
      throw new ForbiddenException(banMessage(token.user));
    }

    const consumed = await this.prisma.loginToken.updateMany({
      where: { token: token.token, used: false },
      data: { used: true },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    const { refreshToken, refreshTokenId } = await this.createRefreshToken(
      token.user.id,
    );
    const accessToken = await this.createAccessToken(token.user, refreshTokenId);
    return { accessToken, refreshToken };
  }

  async resendEmailCode(dto: { loginToken: string }) {
    const token = await this.prisma.loginToken.findFirst({
      where: { token: dto.loginToken },
      include: { user: true },
    });

    if (
      !token ||
      token.used ||
      !token.emailCodeHash ||
      token.emailCodeAttempts >= 5
    ) {
      throw new UnauthorizedException("Invalid login token");
    }
    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException("Login token expired", "token_expired");
    }
    if (isUserBanned(token.user)) {
      throw new ForbiddenException(banMessage(token.user));
    }

    const code = this.generateSixDigitCode();
    const emailCodeHash = await argon.hash(code);
    await this.prisma.loginToken.update({
      where: { token: token.token },
      data: {
        emailCodeHash,
        expiresAt: moment().add(10, "minutes").toDate(),
      },
    });

    try {
      await this.emailService.sendLoginCode(token.user.email, { code });
    } catch (e) {
      this.logger.error(`Failed to resend login code: ${e}`);
      throw new InternalServerErrorException(
        "We couldn't resend your code. Please try again in a moment.",
      );
    }

    return { sent: true };
  }

  async requestResetPassword(email: string) {
    if (this.config.get("oauth.disablePassword"))
      throw new ForbiddenException("Password sign in is disabled");

    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { resetPasswordToken: true },
    });

    if (!user) return;

    if (user.ldapDN) {
      this.logger.log(
        `Failed password reset request for user ${email} because it is an LDAP user`,
      );
      throw new BadRequestException(
        "This account can't reset its password here. Please contact your administrator.",
      );
    }

    if (user.resetPasswordToken) {
      await this.prisma.resetPasswordToken.delete({
        where: { token: user.resetPasswordToken.token },
      });
    }

    const { token } = await this.prisma.resetPasswordToken.create({
      data: {
        expiresAt: moment().add(1, "hour").toDate(),
        user: { connect: { id: user.id } },
      },
    });

    this.emailService
      .sendResetPasswordEmail(user.email, token)
      .catch((e) =>
        this.logger.error(
          `Failed to send password reset email: ${e?.message || e}`,
        ),
      );
  }

  async resetPassword(token: string, newPassword: string) {
    if (this.config.get("oauth.disablePassword"))
      throw new ForbiddenException("Password sign in is disabled");

    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken: { token } },
    });

    if (!user) throw new BadRequestException("Token invalid or expired");

    const newPasswordHash = await argon.hash(newPassword);

    await this.prisma.resetPasswordToken.delete({
      where: { token },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    });
  }

  async updatePassword(user: User, newPassword: string, oldPassword?: string) {
    const isPasswordValid =
      !user.password || (await argon.verify(user.password, oldPassword));

    if (!isPasswordValid) throw new ForbiddenException("Invalid password");

    const hash = await argon.hash(newPassword);

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    return this.createRefreshToken(user.id);
  }

  async createAccessToken(user: User, refreshTokenId: string) {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        refreshTokenId,
      },
      {
        expiresIn: "7d",
        secret: this.config.get("internal.jwtSecret"),
      },
    );
  }

  async signOut(accessToken: string) {
    let refreshTokenId: string | undefined;

    try {
      const payload = await this.jwtService.verifyAsync<{
        refreshTokenId?: string;
      }>(accessToken, {
        secret: this.config.get("internal.jwtSecret"),
      });
      refreshTokenId = payload.refreshTokenId;
    } catch {
      refreshTokenId = undefined;
    }

    if (refreshTokenId) {
      const oauthIDToken = await this.prisma.refreshToken
        .findFirst({
          select: { oauthIDToken: true },
          where: { id: refreshTokenId },
        })
        .then((refreshToken) => refreshToken?.oauthIDToken)
        .catch((e) => {
          if (e.code != "P2025") throw e;
        });
      await this.prisma.refreshToken
        .delete({ where: { id: refreshTokenId } })
        .catch((e) => {
          if (e.code != "P2025") throw e;
        });

      if (typeof oauthIDToken === "string") {
        const [providerName, idTokenHint] = oauthIDToken.split(":");
        const provider = this.oAuthService.availableProviders()[providerName];
        let signOutFromProviderSupportedAndActivated = false;
        try {
          signOutFromProviderSupportedAndActivated = this.config.get(
            `oauth.${providerName}-signOut`,
          );
        } catch (_) {
        }
        if (
          provider instanceof GenericOidcProvider &&
          signOutFromProviderSupportedAndActivated
        ) {
          const configuration = await provider.getConfiguration();
          if (URL.canParse(configuration.end_session_endpoint)) {
            const redirectURI = new URL(configuration.end_session_endpoint);
            redirectURI.searchParams.append(
              "post_logout_redirect_uri",
              this.config.get("general.appUrl"),
            );
            redirectURI.searchParams.append("id_token_hint", idTokenHint);
            redirectURI.searchParams.append(
              "client_id",
              this.config.get(`oauth.${providerName}-clientId`),
            );
            return redirectURI.toString();
          }
        }
      }
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const refreshTokenMetaData = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!refreshTokenMetaData || refreshTokenMetaData.expiresAt < new Date())
      throw new UnauthorizedException();

    if (
      isUserBanned(refreshTokenMetaData.user) ||
      (refreshTokenMetaData.user.tokensValidAfter &&
        refreshTokenMetaData.createdAt <
          refreshTokenMetaData.user.tokensValidAfter)
    ) {
      throw new UnauthorizedException();
    }

    return this.createAccessToken(
      refreshTokenMetaData.user,
      refreshTokenMetaData.id,
    );
  }

  async createRefreshToken(userId: string, idToken?: string) {
    const sessionDuration = this.config.get("general.sessionDuration");
    const { id, token } = await this.prisma.refreshToken.create({
      data: {
        userId,
        expiresAt: moment()
          .add(sessionDuration.value, sessionDuration.unit)
          .toDate(),
        oauthIDToken: idToken,
      },
    });

    return { refreshTokenId: id, refreshToken: token };
  }

  async createLoginToken(userId: string) {
    const loginToken = (
      await this.prisma.loginToken.create({
        data: { userId, expiresAt: moment().add(5, "minutes").toDate() },
      })
    ).token;

    return loginToken;
  }

  addTokensToResponse(
    response: Response,
    refreshToken?: string,
    accessToken?: string,
  ) {
    const isSecure = this.config.get("general.secureCookies");
    if (accessToken)
      response.cookie("access_token", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        maxAge: 1000 * 60 * 60 * 24 * 30 * 3,
      });
    if (refreshToken) {
      const now = moment();
      const sessionDuration = this.config.get("general.sessionDuration");
      const maxAge = moment(now)
        .add(sessionDuration.value, sessionDuration.unit)
        .diff(now);
      response.cookie("refresh_token", refreshToken, {
        path: "/api/auth/token",
        httpOnly: true,
        sameSite: "strict",
        secure: isSecure,
        maxAge,
      });
    }
  }

  async getIdOfCurrentUser(request: Request): Promise<string | null> {
    if (!request.cookies.access_token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        iat?: number;
      }>(request.cookies.access_token, {
        secret: this.config.get("internal.jwtSecret"),
      });
      if (!payload?.sub) return null;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (isTokenRevoked(user, payload.iat)) return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  async verifyPassword(user: User, password: string) {
    if (!user.password && this.config.get("ldap.enabled")) {
      return !!this.ldapService.authenticateUser(user.username, password);
    }

    return argon.verify(user.password, password);
  }
}
