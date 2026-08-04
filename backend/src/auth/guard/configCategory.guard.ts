import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { ConfigService } from "src/config/config.service";
import { CONFIG_CATEGORY_CAPABILITIES, hasCapability } from "../capabilities";

@Injectable()
export class ConfigCategoryGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User | undefined = request.user;
    if (!user) return false;
    if (user.isAdmin) return true;

    const granted = this.config.get("access.managerCapabilities");

    const categories: string[] = request.params?.category
      ? [request.params.category]
      :
        Array.from(
          new Set(
            (Array.isArray(request.body) ? request.body : [])
              .map((item: { key?: string }) =>
                typeof item?.key === "string" ? item.key.split(".")[0] : null,
              )
              .filter(Boolean) as string[],
          ),
        );

    if (!categories.length) return false;

    for (const category of categories) {
      const capability = CONFIG_CATEGORY_CAPABILITIES[category];
      if (!capability) {
        throw new ForbiddenException(
          `The ${category} settings are administrator only.`,
        );
      }
      if (!hasCapability(user, capability, granted)) {
        throw new ForbiddenException(
          `You do not have access to the ${category} settings.`,
        );
      }
    }

    return true;
  }
}
