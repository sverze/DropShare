export type TransactionalEmailMeta = {
  slug: string;
  name: string;
  description: string;
  subjectConfigKey?: string;
  defaultSubject: string;
  preheader: string;
  variables: string[];
};

export const TRANSACTIONAL_EMAILS: TransactionalEmailMeta[] = [
  {
    slug: "share-notification",
    name: "Share Notification",
    description:
      "Sent to each recipient email when a user completes a share with recipients.",
    subjectConfigKey: "email.shareRecipientsSubject",
    defaultSubject: "Files shared with you",
    preheader: "{{creatorName}} shared files with you",
    variables: [
      "creatorName",
      "creatorEmail",
      "description",
      "expiresText",
      "shareUrl", "appName"],
  },
  {
    slug: "reverse-share",
    name: "Reverse Share Upload",
    description:
      "Sent to the reverse-share owner when someone uploads files using their link.",
    subjectConfigKey: "email.reverseShareSubject",
    defaultSubject: "Reverse share link used",
    preheader: "New files uploaded to your reverse share",
    variables: ["shareUrl", "appName"],
  },
  {
    slug: "password-reset",
    name: "Password Reset",
    description: "Sent when a user requests a password reset link.",
    subjectConfigKey: "email.resetPasswordSubject",
    defaultSubject: "{{appName}} password reset",
    preheader: "Reset your {{appName}} password",
    variables: ["resetUrl", "appName"],
  },
  {
    slug: "login-code",
    name: "Sign-in Code",
    description:
      "The 6-digit verification code sent when a user signs in without 2FA or a passkey.",
    defaultSubject: "Your {{appName}} sign-in code",
    preheader: "Your {{appName}} sign-in code - expires in 10 minutes",
    variables: ["code", "appUrl", "appName"],
  },
  {
    slug: "invite",
    name: "Account Invite",
    description:
      "Sent when an admin creates an account for someone, including their temporary password.",
    subjectConfigKey: "email.inviteSubject",
    defaultSubject: "{{appName}} invite",
    preheader: "Your {{appName}} account is ready",
    variables: ["email", "password", "loginUrl", "appName"],
  },
  {
    slug: "smtp-test",
    name: "SMTP Test",
    description:
      "Sent by the “send test email” button on the SMTP configuration page.",
    defaultSubject: "Test email",
    preheader: "{{appName}} test email - configuration successful",
    variables: ["recipientEmail", "appName"],
  },
];

export function placeholderVars(
  meta: TransactionalEmailMeta,
): Record<string, string> {
  return Object.fromEntries(meta.variables.map((v) => [v, `{{${v}}}`]));
}

const PREVIEW_SAMPLES: Record<string, string> = {
  creatorName: "alexcarter",
  creatorEmail: "alex@example.com",
  description: "Here are the photos from the weekend - let me know!",
  expiresText: "in 7 days",
  shareUrl: "https://your-domain.com/s/summer-photos",
  resetUrl: "https://your-domain.com/auth/resetPassword/example-token",
  code: "482913",
  appUrl: "https://your-domain.com",
  appName: "DropShare",
  email: "newuser@example.com",
  password: "T3mp-Pa55word",
  loginUrl: "https://your-domain.com/auth/signIn",
  username: "alexcarter",
  shareCount: "3",
  shareLabel: "3 shares",
  sizeLabel: "1.4 GB",
  shareLinksUntil: "July 28, 2026",
  exportUntil: "August 15, 2026",
  exportUrl: "https://your-domain.com/export",
  recipientEmail: "you@example.com",
};

export function previewVars(
  meta: TransactionalEmailMeta,
): Record<string, string> {
  return Object.fromEntries(
    meta.variables.map((v) => [v, PREVIEW_SAMPLES[v] ?? `[${v}]`]),
  );
}
