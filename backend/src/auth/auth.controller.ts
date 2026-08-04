import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { Request, Response } from "express";
import { ConfigService } from "src/config/config.service";
import { AuthService } from "./auth.service";
import { AuthPasskeyService } from "./authPasskey.service";
import { AuthTotpService } from "./authTotp.service";
import { GetUser } from "./decorator/getUser.decorator";
import { AuthRegisterDTO } from "./dto/authRegister.dto";
import { AuthSignInDTO } from "./dto/authSignIn.dto";
import { AuthSignInTotpDTO } from "./dto/authSignInTotp.dto";
import {
  ResendEmailCodeDTO,
  SignInEmailCodeDTO,
} from "./dto/signInEmailCode.dto";
import { EnableTotpDTO } from "./dto/enableTotp.dto";
import { ResetPasswordDTO } from "./dto/resetPassword.dto";
import { TokenDTO } from "./dto/token.dto";
import { UpdatePasswordDTO } from "./dto/updatePassword.dto";
import { VerifyTotpDTO } from "./dto/verifyTotp.dto";
import { RequestResetPasswordDTO } from "./dto/requestResetPassword.dto";
import { JwtGuard } from "./guard/jwt.guard";
import { CapabilityGuard } from "./guard/capability.guard";
import { RequireCapability } from "./decorator/requireCapability.decorator";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private authTotpService: AuthTotpService,
    private authPasskeyService: AuthPasskeyService,
    private config: ConfigService,
  ) {}

  @Post("signUp")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  async signUp(
    @Body() dto: AuthRegisterDTO,
    @Req() { ip }: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!this.config.get("share.allowRegistration"))
      throw new ForbiddenException("Registration is not allowed");

    const result = await this.authService.signUp(dto, ip);

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return result;
  }

  @Post("signIn")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async signIn(
    @Body() dto: AuthSignInDTO,
    @Req() { ip }: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signIn(dto, ip);

    if (result.accessToken && result.refreshToken) {
      this.authService.addTokensToResponse(
        response,
        result.refreshToken,
        result.accessToken,
      );
    }

    return result;
  }

  @Post("signIn/totp")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async signInTotp(
    @Body() dto: AuthSignInTotpDTO,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authTotpService.signInTotp(dto);

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return new TokenDTO().from(result);
  }

  @Post("signIn/email-code")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async signInEmailCode(
    @Body() dto: SignInEmailCodeDTO,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signInEmailCode(dto);

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return new TokenDTO().from(result);
  }

  @Post("signIn/email-code/resend")
  @Throttle({
    default: {
      limit: 5,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async resendEmailCode(@Body() dto: ResendEmailCodeDTO) {
    return this.authService.resendEmailCode(dto);
  }

  @Get("passkey/check/:emailOrUsername")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60,
    },
  })
  async checkUserHasPasskeys(@Param("emailOrUsername") emailOrUsername: string) {
    const hasPasskeys = await this.authPasskeyService.userHasPasskeys(emailOrUsername);
    return { hasPasskeys };
  }

  @Post("passkey/register/options")
  @UseGuards(JwtGuard)
  async getPasskeyRegistrationOptions(@GetUser() user: User) {
    return this.authPasskeyService.generateRegistrationOptions(user);
  }

  @Post("passkey/register")
  @UseGuards(JwtGuard)
  async registerPasskey(
    @GetUser() user: User,
    @Body() body: { response: any; name?: string },
  ) {
    return this.authPasskeyService.verifyRegistration(user, body.response, body.name);
  }

  @Post("passkey/login/options")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60,
    },
  })
  async getPasskeyAuthenticationOptions(
    @Body() body: { emailOrUsername?: string },
  ) {
    return this.authPasskeyService.generateAuthenticationOptions(body.emailOrUsername);
  }

  @Post("passkey/login")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(200)
  async loginWithPasskey(
    @Body() body: { response: any; challengeKey: string },
    @Req() { ip }: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authPasskeyService.verifyAuthentication(
      body.response,
      body.challengeKey,
      ip,
    );

    this.authService.addTokensToResponse(
      response,
      result.refreshToken,
      result.accessToken,
    );

    return { accessToken: result.accessToken };
  }

  @Get("passkey/list")
  @UseGuards(JwtGuard)
  async listPasskeys(@GetUser() user: User) {
    return this.authPasskeyService.getUserPasskeys(user.id);
  }

  @Patch("passkey/:id")
  @UseGuards(JwtGuard)
  async renamePasskey(
    @GetUser() user: User,
    @Param("id") passkeyId: string,
    @Body() body: { name: string },
  ) {
    return this.authPasskeyService.renamePasskey(user.id, passkeyId, body.name);
  }

  @Delete("passkey/:id")
  @UseGuards(JwtGuard)
  async deletePasskey(@GetUser() user: User, @Param("id") passkeyId: string) {
    return this.authPasskeyService.deletePasskey(user.id, passkeyId);
  }

  @Post("resetPassword/request")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(202)
  async requestResetPassword(@Body() dto: RequestResetPasswordDTO) {
    await this.authService.requestResetPassword(dto.email);
  }

  @Post("resetPassword")
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    return await this.authService.resetPassword(dto.token, dto.password);
  }

  @Patch("password")
  @UseGuards(JwtGuard)
  async updatePassword(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: UpdatePasswordDTO,
  ) {
    const result = await this.authService.updatePassword(
      user,
      dto.password,
      dto.oldPassword,
    );

    this.authService.addTokensToResponse(response, result.refreshToken);
    return new TokenDTO().from(result);
  }

  @Post("token")
  @HttpCode(200)
  async refreshAccessToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.cookies.refresh_token) throw new UnauthorizedException();

    const accessToken = await this.authService.refreshAccessToken(
      request.cookies.refresh_token,
    );
    this.authService.addTokensToResponse(response, undefined, accessToken);
    return new TokenDTO().from({ accessToken });
  }

  @Post("signOut")
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const redirectURI = await this.authService.signOut(
      request.cookies.access_token,
    );

    const isSecure = this.config.get("general.secureCookies");
    response.cookie("access_token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: -1,
      secure: isSecure,
    });
    response.cookie("refresh_token", "", {
      path: "/api/auth/token",
      httpOnly: true,
      sameSite: "strict",
      maxAge: -1,
      secure: isSecure,
    });

    if (typeof redirectURI === "string") {
      return { redirectURI: redirectURI.toString() };
    }
  }

  @Post("totp/enable")
  @UseGuards(JwtGuard)
  async enableTotp(@GetUser() user: User, @Body() body: EnableTotpDTO) {
    return this.authTotpService.enableTotp(user, body.password);
  }

  @Post("totp/verify")
  @UseGuards(JwtGuard)
  async verifyTotp(@GetUser() user: User, @Body() body: VerifyTotpDTO) {
    return this.authTotpService.verifyTotp(user, body.password, body.code);
  }

  @Post("totp/disable")
  @UseGuards(JwtGuard)
  async disableTotp(@GetUser() user: User, @Body() body: VerifyTotpDTO) {
    return this.authTotpService.disableTotp(user, body.password, body.code);
  }

  @Post("totp/admin-reset/:userId")
  @RequireCapability("users.totpReset")
  @UseGuards(JwtGuard, CapabilityGuard)
  async adminResetTotp(
    @GetUser() adminUser: User,
    @Param("userId") userId: string,
  ) {
    return this.authTotpService.adminResetTotp(adminUser, userId);
  }

  @Get("session")
  @HttpCode(200)
  async getSession(@Req() request: Request) {
    return {
      authenticated: !!(await this.authService.getIdOfCurrentUser(request)),
    };
  }
}
