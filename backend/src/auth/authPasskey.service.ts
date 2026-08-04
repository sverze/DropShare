import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "./auth.service";
import { banMessage, isUserBanned } from "./ban.util";

const challengeStore = new Map<string, { challenge: string; expires: Date }>();

@Injectable()
export class AuthPasskeyService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private authService: AuthService,
  ) {}

  private readonly logger = new Logger(AuthPasskeyService.name);

  private getRpId(): string {
    const configuredRpId = process.env.WEBAUTHN_RP_ID?.trim();
    if (configuredRpId) return configuredRpId;

    const appUrl = this.config.get("general.appUrl");
    try {
      const url = new URL(appUrl);
      return url.hostname;
    } catch {
      return "localhost";
    }
  }

  private getRpName(): string {
    const configuredRpName = process.env.WEBAUTHN_RP_NAME?.trim();
    if (configuredRpName) return configuredRpName;

    return this.config.get("general.appName") || "This site";
  }

  private getOrigins(): string | string[] {
    const configuredOrigins = process.env.WEBAUTHN_ORIGINS
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (configuredOrigins && configuredOrigins.length > 0) {
      return configuredOrigins.length === 1 ? configuredOrigins[0] : configuredOrigins;
    }

    return this.config.get("general.appUrl") || "http://localhost:3000";
  }

  async generateRegistrationOptions(user: User) {
    const rpId = this.getRpId();
    const rpName = this.getRpName();

    const existingPasskeys = await this.prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });

    const excludeCredentials = existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports
        ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: user.email,
      userDisplayName: user.username,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    challengeStore.set(user.id, {
      challenge: options.challenge,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });

    return options;
  }

  async verifyRegistration(
    user: User,
    response: RegistrationResponseJSON,
    name?: string,
  ) {
    const rpId = this.getRpId();
    const origin = this.getOrigins();

    const storedData = challengeStore.get(user.id);
    if (!storedData || storedData.expires < new Date()) {
      challengeStore.delete(user.id);
      throw new BadRequestException("Challenge expired or not found");
    }

    const expectedChallenge = storedData.challenge;
    challengeStore.delete(user.id);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: false,
      });
    } catch (error) {
      this.logger.error(`Passkey registration verification failed: ${error.message}`);
      throw new BadRequestException("Passkey verification failed");
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException("Passkey verification failed");
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credentialIdBase64url = credential.id;
    
    this.logger.log(`Registering passkey - credential.id type: ${typeof credential.id}`);
    this.logger.log(`Registering passkey - credential.id value: ${credential.id}`);
    this.logger.log(`Registering passkey - storing as: ${credentialIdBase64url}`);

    const existingPasskey = await this.prisma.passkey.findUnique({
      where: { credentialId: credentialIdBase64url },
    });

    if (existingPasskey) {
      throw new BadRequestException("This passkey is already registered");
    }

    const publicKeyBase64url = Buffer.from(credential.publicKey).toString("base64url");

    const passkey = await this.prisma.passkey.create({
      data: {
        credentialId: credentialIdBase64url,
        publicKey: publicKeyBase64url,
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: name || `Passkey ${new Date().toLocaleDateString()}`,
        transports: response.response.transports
          ? JSON.stringify(response.response.transports)
          : null,
        userId: user.id,
      },
    });

    this.logger.log(`Passkey registered for user ${user.email} with credential ID: ${credentialIdBase64url}`);

    return {
      success: true,
      passkeyId: passkey.id,
      name: passkey.name,
    };
  }

  async generateAuthenticationOptions(emailOrUsername?: string) {
    const rpId = this.getRpId();

    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
    let oderId: string | null = null;

    if (emailOrUsername) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: emailOrUsername },
            { username: emailOrUsername },
          ],
        },
        include: { passkeys: true },
      });

      if (user && user.passkeys.length > 0) {
        oderId = user.id;
        allowCredentials = user.passkeys.map((passkey) => ({
          id: passkey.credentialId,
          transports: passkey.transports
            ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
            : undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "preferred",
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    });

    const challengeKey = oderId || `anon_${options.challenge.substring(0, 16)}`;
    challengeStore.set(challengeKey, {
      challenge: options.challenge,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });

    return {
      ...options,
      challengeKey,
    };
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    challengeKey: string,
    ip: string,
  ) {
    const rpId = this.getRpId();
    const origin = this.getOrigins();

    const storedData = challengeStore.get(challengeKey);
    if (!storedData || storedData.expires < new Date()) {
      challengeStore.delete(challengeKey);
      throw new UnauthorizedException("Challenge expired or not found");
    }

    const expectedChallenge = storedData.challenge;
    challengeStore.delete(challengeKey);

    const credentialId = response.id;
    
    const normalizeBase64Url = (str: string) => {
      return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };
    
    const normalizedCredentialId = normalizeBase64Url(credentialId);
    
    this.logger.debug(`Looking for passkey with credential ID: ${credentialId} (normalized: ${normalizedCredentialId})`);
    
    let passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: credentialId },
      include: { user: true },
    });

    if (!passkey) {
      passkey = await this.prisma.passkey.findUnique({
        where: { credentialId: normalizedCredentialId },
        include: { user: true },
      });
    }

    if (!passkey) {
      const allPasskeys = await this.prisma.passkey.findMany({
        include: { user: true },
      });
      
      for (const p of allPasskeys) {
        const normalizedStored = normalizeBase64Url(p.credentialId);
        this.logger.debug(`Comparing: ${normalizedCredentialId} vs ${normalizedStored}`);
        if (normalizedStored === normalizedCredentialId) {
          passkey = p;
          break;
        }
      }
    }

    if (!passkey) {
      const allPasskeys = await this.prisma.passkey.findMany({
        select: { credentialId: true },
      });
      this.logger.warn(`Passkey authentication failed: credential not found. Looking for: ${credentialId}`);
      this.logger.warn(`Stored credential IDs: ${allPasskeys.map(p => p.credentialId).join(', ')}`);
      throw new UnauthorizedException("Passkey not found");
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: Number(passkey.counter),
          transports: passkey.transports
            ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
            : undefined,
        },
        requireUserVerification: false,
      });
    } catch (error) {
      this.logger.error(`Passkey authentication verification failed: ${error.message}`);
      throw new UnauthorizedException("Passkey verification failed");
    }

    if (!verification.verified) {
      throw new UnauthorizedException("Passkey verification failed");
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    if (isUserBanned(passkey.user)) {
      throw new ForbiddenException(banMessage(passkey.user));
    }

    this.logger.log(`Successful passkey login for user ${passkey.user.email} from IP ${ip}`);

    const { refreshToken, refreshTokenId } = await this.authService.createRefreshToken(
      passkey.user.id,
    );
    const accessToken = await this.authService.createAccessToken(
      passkey.user,
      refreshTokenId,
    );

    return { accessToken, refreshToken, user: passkey.user };
  }

  async getUserPasskeys(userId: string) {
    const passkeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        deviceType: true,
        backedUp: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return passkeys;
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new BadRequestException("Passkey not found");
    }

    await this.prisma.passkey.delete({
      where: { id: passkeyId },
    });

    this.logger.log(`Passkey ${passkeyId} deleted for user ${userId}`);

    return { success: true };
  }

  async renamePasskey(userId: string, passkeyId: string, name: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new BadRequestException("Passkey not found");
    }

    await this.prisma.passkey.update({
      where: { id: passkeyId },
      data: { name },
    });

    return { success: true };
  }

  async userHasPasskeys(emailOrUsername: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername },
        ],
      },
      include: { _count: { select: { passkeys: true } } },
    });

    return user ? user._count.passkeys > 0 : false;
  }
}
