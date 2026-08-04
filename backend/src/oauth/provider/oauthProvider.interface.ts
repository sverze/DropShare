import { OAuthCallbackDto } from "../dto/oauthCallback.dto";
import { OAuthSignInDto } from "../dto/oauthSignIn.dto";

export interface OAuthProvider<T, C = OAuthCallbackDto> {
  getAuthEndpoint(state: string): Promise<string>;

  getToken(query: C): Promise<OAuthToken<T>>;

  getUserInfo(token: OAuthToken<T>, query: C): Promise<OAuthSignInDto>;
}

export interface OAuthToken<T> {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  rawToken: T;
}
