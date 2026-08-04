import api from "./api.service";

const signIn = async (emailOrUsername: string, password: string) => {
  const emailOrUsernameBody = emailOrUsername.includes("@")
    ? { email: emailOrUsername }
    : { username: emailOrUsername };

  const response = await api.post("auth/signIn", {
    ...emailOrUsernameBody,
    password,
  });

  try {
    localStorage.removeItem("sso_signed_out");
  } catch {
  }

  return response;
};

const signInTotp = (totp: string, loginToken: string) => {
  return api.post("auth/signIn/totp", {
    totp,
    loginToken,
  });
};

const signInEmailCode = (code: string, loginToken: string) => {
  return api.post("auth/signIn/email-code", {
    code,
    loginToken,
  });
};

const resendEmailCode = (loginToken: string) => {
  return api.post("auth/signIn/email-code/resend", {
    loginToken,
  });
};

const signUp = async (
  email: string,
  username: string,
  password: string,
  inviteCode?: string,
  appClient?: string,
) => {
  const response = await api.post("auth/signUp", {
    email,
    username,
    password,
    ...(inviteCode && { inviteCode }),
    ...(appClient && { appClient }),
  });

  return response;
};

const signOut = async (options: { redirect?: boolean } = {}) => {
  try {
    localStorage.setItem("sso_signed_out", "1");
    sessionStorage.removeItem("sso_check_done");
    sessionStorage.removeItem("just_logged_in");
  } catch {
  }

  const response = await api.post("/auth/signOut").catch((error) => {
    if (options.redirect === false) throw error;
    return { data: null };
  });
  if (options.redirect === false) return response;

  if (URL.canParse(response.data?.redirectURI))
    window.location.href = response.data.redirectURI;
  else {
    // Same-origin so a single distributed image works on any domain (the build
    // never bakes in a specific host here).
    const returnUrl = `${window.location.origin}${window.location.pathname}`;
    window.location.href = `/auth/signOut?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  return response;
};

const refreshAccessToken = async () => {
  try {
    await api.post("/auth/token");
  } catch (e) {
    console.info("Refresh token invalid or expired");
  }
};

const requestResetPassword = async (email: string) => {
  await api.post("/auth/resetPassword/request", { email });
};

const resetPassword = async (token: string, password: string) => {
  await api.post("/auth/resetPassword", { token, password });
};

const updatePassword = async (oldPassword: string, password: string) => {
  await api.patch("/auth/password", { oldPassword, password });
};

const enableTOTP = async (password: string) => {
  const { data } = await api.post("/auth/totp/enable", { password });

  return {
    totpAuthUrl: data.totpAuthUrl,
    totpSecret: data.totpSecret,
    qrCode: data.qrCode,
  };
};

const verifyTOTP = async (totpCode: string, password: string) => {
  await api.post("/auth/totp/verify", {
    code: totpCode,
    password,
  });
};

const disableTOTP = async (totpCode: string, password: string) => {
  await api.post("/auth/totp/disable", {
    code: totpCode,
    password,
  });
};

const getAvailableOAuth = async () => {
  return api.get("/oauth/available");
};

const getOAuthStatus = () => {
  return api.get("/oauth/status");
};

export default {
  signIn,
  signInTotp,
  signInEmailCode,
  resendEmailCode,
  signUp,
  signOut,
  refreshAccessToken,
  updatePassword,
  requestResetPassword,
  resetPassword,
  enableTOTP,
  verifyTOTP,
  disableTOTP,
  getAvailableOAuth,
  getOAuthStatus,
};
