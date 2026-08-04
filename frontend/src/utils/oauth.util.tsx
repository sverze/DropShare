import {
  SiDiscord,
  SiGithub,
  SiGoogle,
  SiMicrosoft,
  SiOpenid,
} from "react-icons/si";
import React from "react";
import api from "../services/api.service";

const getOAuthUrl = (
  appUrl: string,
  provider: string,
  inviteCode?: string,
  appClient?: string,
) => {
  const url = new URL(`/api/oauth/auth/${provider}`, appUrl);

  if (inviteCode?.trim()) {
    url.searchParams.set("inviteCode", inviteCode.trim().toUpperCase());
  }
  if (appClient?.trim()) {
    url.searchParams.set("appClient", appClient.trim());
  }

  return url.toString();
};

const getOAuthIcon = (provider: string) => {
  return {
    google: <SiGoogle />,
    microsoft: <SiMicrosoft />,
    github: <SiGithub />,
    discord: <SiDiscord />,
    oidc: <SiOpenid />,
  }[provider];
};

const unlinkOAuth = (provider: string) => {
  return api.post(`/oauth/unlink/${provider}`);
};

export { getOAuthUrl, getOAuthIcon, unlinkOAuth };
