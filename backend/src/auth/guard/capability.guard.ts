import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { User } from "@prisma/client";
import { ConfigService } from "src/config/config.service";
import { Capability, hasCapability } from "../capabilities";
import { REQUIRED_CAPABILITY } from "../decorator/requireCapability.decorator";

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { user }: { user?: User } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.isAdmin) return true;

    const capability = this.reflector.getAllAndOverride<Capability | undefined>(
      REQUIRED_CAPABILITY,
      [context.getHandler(), context.getClass()],
    );
    if (!capability) return false;

    return hasCapability(
      user,
      capability,
      this.config.get("access.managerCapabilities"),
    );
  }
}
