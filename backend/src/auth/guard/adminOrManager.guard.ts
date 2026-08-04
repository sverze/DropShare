import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";

@Injectable()
export class AdminOrManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user }: { user?: User } = context.switchToHttp().getRequest();
    return !!user && (user.isAdmin || user.role === "manager");
  }
}
