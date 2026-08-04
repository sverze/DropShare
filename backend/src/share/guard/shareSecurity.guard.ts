import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import * as moment from "moment";
import * as argon from "argon2";
import { User } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareService } from "src/share/share.service";
import { JwtGuard } from "src/auth/guard/jwt.guard";

@Injectable()
export class ShareSecurityGuard extends JwtGuard {
  constructor(
    private shareService: ShareService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();

    const shareId = (Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id) as string;

    const shareToken = request.cookies[`share_${shareId}_token`];
    
    const apiPassword = request.headers["x-share-password"] as string;

    const share = (await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true, reverseShare: true },
    })) as any;

    if (
      !share ||
      (moment().isAfter(share.expiration) &&
        !moment(share.expiration).isSame(0))
    )
      throw new NotFoundException("Share not found");

    if (share.security?.password) {
      if (apiPassword) {
        try {
          const isValidPassword = await argon.verify(
            share.security.password,
            apiPassword
          );
          
          if (!isValidPassword) {
            throw new ForbiddenException(
              "Invalid password",
              "invalid_password",
            );
          }
        } catch (error) {
          throw new ForbiddenException(
            "Invalid password",
            "invalid_password",
          );
        }
      } else if (!shareToken) {
        throw new ForbiddenException(
          "This share is password protected",
          "share_password_required",
        );
      } else {
        if (!(await this.shareService.verifyShareToken(shareId, shareToken))) {
          throw new ForbiddenException(
            "Share token required",
            "share_token_required",
          );
        }
      }
    }

    try {
      await super.canActivate(context);
    } catch {
      request.user = undefined;
    }

    const user = request.user as User;

    if (
      share.reverseShare &&
      !share.reverseShare.publicAccess &&
      share.creatorId !== user?.id &&
      share.reverseShare.creatorId !== user?.id
    )
      throw new ForbiddenException(
        "Only reverse share creator can access this share",
        "private_share",
      );

    return true;
  }
}
