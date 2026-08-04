import {
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { Request } from "express";
import { ShareService } from "src/share/share.service";
import { JwtGuard } from "../../auth/guard/jwt.guard";

@Injectable()
export class ShareOwnerGuard extends JwtGuard {
  constructor(private shareService: ShareService) {
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

    const anonymousOwnerToken = request.cookies[`share_${shareId}_owner_token`];

    let user: User | null = null;

    try {
      await super.canActivate(context);
      user = request.user as User;
    } catch {
      user = null;
    }

    await this.shareService.assertCanMutateShare(
      shareId,
      user,
      anonymousOwnerToken,
    );

    return true;
  }
}
