import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ConfigService } from "src/config/config.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";

@Injectable()
export class CreateShareGuard extends JwtGuard {
  constructor(
    private reverseShareService: ReverseShareService,
    private configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      if (await super.canActivate(context)) {
        const user = request.user;
        if (user?.isAdmin || user?.canCreateShares !== false) return true;
        if (this.configService.get("share.allowUninvitedRegisteredShares")) {
          return true;
        }

        if (
          request.cookies.reverse_share_token &&
          (await this.reverseShareService.isValid(
            request.cookies.reverse_share_token,
          ))
        ) {
          return true;
        }

        throw new ForbiddenException(
          "This account needs an invite code before it can create shares.",
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
    }

    const reverseShareTokenId = request.cookies.reverse_share_token;

    if (this.configService.get("share.allowUnauthenticatedShares")) {
      return true;
    }

    if (!reverseShareTokenId) return false;

    const isReverseShareTokenValid =
      await this.reverseShareService.isValid(reverseShareTokenId);

    return isReverseShareTokenValid;
  }
}
