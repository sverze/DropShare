import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareSecurityGuard } from "src/share/guard/shareSecurity.guard";
import { ShareService } from "src/share/share.service";

/**
 * Access control for the file routes - download, zip, HLS, video preview,
 * spectrum, thumbnail, metadata.
 *
 * This class used to override `canActivate` and never call the parent on its
 * main path: with no `share_<id>_token` cookie it ran its own expiry, password
 * and maxViews checks and returned `true`, so the file bytes were served with
 * no authentication and no authorization. Only the cookie path delegated to
 * `ShareSecurityGuard`, which meant presenting NO credential took the less
 * protected route - the opposite of the intent.
 *
 * It now always defers to the parent for authentication, authorization,
 * expiry and password, and adds only the one check the parent does not make:
 * the per-share view cap.
 */
@Injectable()
export class FileSecurityGuard extends ShareSecurityGuard {
  constructor(
    private _shareService: ShareService,
    private _prisma: PrismaService,
  ) {
    super(_shareService, _prisma);
  }

  async canActivate(context: ExecutionContext) {
    // Authentication, group authorization, expiry and password. Throws rather
    // than returning false, so there is no path past it.
    await super.canActivate(context);

    const request: Request = context.switchToHttp().getRequest();

    const shareId = (Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id) as string;

    const share = await this._prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true },
    });

    if (!share) throw new NotFoundException("File not found");

    if (share.security?.maxViews && share.security.maxViews <= share.views) {
      throw new ForbiddenException(
        "Maximum views exceeded",
        "share_max_views_exceeded",
      );
    }

    return true;
  }
}
