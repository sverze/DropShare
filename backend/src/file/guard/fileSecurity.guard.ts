import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import * as moment from "moment";
import * as argon from "argon2";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareSecurityGuard } from "src/share/guard/shareSecurity.guard";
import { ShareService } from "src/share/share.service";

@Injectable()
export class FileSecurityGuard extends ShareSecurityGuard {
  constructor(
    private _shareService: ShareService,
    private _prisma: PrismaService,
  ) {
    super(_shareService, _prisma);
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

    const share = (await this._prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true },
    })) as any;

    if (!shareToken) {
      if (
        !share ||
        (moment().isAfter(share.expiration) &&
          !moment(share.expiration).isSame(0))
      ) {
        throw new NotFoundException("File not found");
      }

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
        } else {
          throw new ForbiddenException("This share is password protected");
        }
      }

      if (share.security?.maxViews && share.security.maxViews <= share.views) {
        throw new ForbiddenException(
          "Maximum views exceeded",
          "share_max_views_exceeded",
        );
      }

      return true;
    } else {
      return super.canActivate(context);
    }
  }
}
