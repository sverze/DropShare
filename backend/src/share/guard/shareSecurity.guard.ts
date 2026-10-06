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
import { PUBLIC_VISIBILITY } from "src/share/share.constants";

/**
 * Access control for a share.
 *
 * This guard used to let anonymous requests through. It called
 * `super.canActivate()` inside a `try/catch` that discarded the failure and
 * set `request.user = undefined`, then returned `true` for anyone who could
 * satisfy an optional password. A share was therefore readable by whoever held
 * its URL, and `Share.groupId` - settable in the UI, and read as meaning
 * "only this group can see it" - was never consulted by any guard.
 *
 * It is now deny-by-default:
 *
 *   1. A share marked PUBLIC is readable by anyone holding the link, with no
 *      account. That is the product: links you can send to people who are not
 *      members. Uploading still requires an account - see createShare.guard.
 *   2. A share marked PRIVATE requires authentication, and the viewer must be
 *      the creator, a member of the share's group, the owner of the reverse
 *      share that produced it, or an admin.
 *   3. A share password is still honoured on top of either, as defence in
 *      depth rather than as the boundary.
 *
 * Visibility defaults to PRIVATE on the column, so the migration that added it
 * could not publish anything retroactively; new shares take their visibility
 * from the `share.defaultShareVisibility` config variable instead.
 *
 * A viewer who is not allowed gets 404, not 403 - a 403 confirms the share
 * exists to someone with no business knowing that.
 *
 * `FileSecurityGuard` extends this class, so every download, zip, HLS,
 * preview, spectrum and thumbnail route inherits the same decision.
 */
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

    const share = (await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true, reverseShare: true },
    })) as any;

    // An expiration of 0 is the sentinel for "never expires".
    if (
      !share ||
      (moment().isAfter(share.expiration) &&
        !moment(share.expiration).isSame(0))
    )
      throw new NotFoundException("Share not found");

    if (share.visibility !== PUBLIC_VISIBILITY) {
      // Private: authenticate, but swallow the failure so an anonymous caller
      // gets the same 404 as for a share that does not exist. Letting the 401
      // escape here would confirm the id is real to someone with no business
      // knowing that - and unlike a public share, there is nothing they are
      // entitled to see.
      try {
        await super.canActivate(context);
      } catch {
        throw new NotFoundException("Share not found");
      }

      const user = request.user as User;
      if (!user) throw new NotFoundException("Share not found");

      if (!(await this.isViewerAllowed(share, user)))
        throw new NotFoundException("Share not found");
    }

    if (share.security?.password) {
      const shareToken = request.cookies[`share_${shareId}_token`];
      const apiPassword = request.headers["x-share-password"] as string;

      if (apiPassword) {
        try {
          const isValidPassword = await argon.verify(
            share.security.password,
            apiPassword,
          );

          if (!isValidPassword) {
            throw new ForbiddenException("Invalid password", "invalid_password");
          }
        } catch (error) {
          throw new ForbiddenException("Invalid password", "invalid_password");
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

    return true;
  }

  /**
   * Deny by default.
   *
   * A share with no `groupId` is visible to its creator and to admins only.
   * That is the conservative reading, and it is the one that matters on an
   * existing install: shares created before this guard existed carry no group,
   * so anything other than creator-only would silently keep them readable by
   * everyone who happens to hold an account.
   *
   * `reverseShare.publicAccess` is deliberately NOT honoured. It existed to
   * make a share anonymously readable, which is the behaviour this guard is
   * here to remove.
   */
  private async isViewerAllowed(share: any, user: User): Promise<boolean> {
    if (user.isAdmin) return true;

    if (share.creatorId && share.creatorId === user.id) return true;

    if (share.reverseShare?.creatorId === user.id) return true;

    if (share.groupId) return this.isGroupMember(user.id, share.groupId);

    return false;
  }

  private async isGroupMember(userId: string, groupId: string) {
    const membership = await this.prisma.userGroupMembership.findFirst({
      where: { userId, groupId },
      select: { userId: true },
    });

    return !!membership;
  }
}
