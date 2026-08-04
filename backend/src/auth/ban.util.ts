import { User } from "@prisma/client";

export function isUserBanned(
  user: Pick<User, "bannedAt" | "bannedUntil"> | null | undefined,
): boolean {
  if (!user || !user.bannedAt) return false;
  if (!user.bannedUntil) return true;
  return user.bannedUntil.getTime() > Date.now();
}

export function isTokenRevoked(
  user:
    | Pick<User, "bannedAt" | "bannedUntil" | "tokensValidAfter">
    | null
    | undefined,
  iat?: number,
): boolean {
  if (!user) return true;
  if (isUserBanned(user)) return true;
  if (
    user.tokensValidAfter &&
    (iat === undefined || iat * 1000 < user.tokensValidAfter.getTime())
  ) {
    return true;
  }
  return false;
}

export function banMessage(
  user: Pick<User, "bannedUntil" | "banReason">,
): string {
  const base = user.bannedUntil
    ? `Your account is suspended until ${user.bannedUntil.toISOString()}.`
    : "Your account has been permanently suspended.";
  return user.banReason ? `${base} Reason: ${user.banReason}` : base;
}
