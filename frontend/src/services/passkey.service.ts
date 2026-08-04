import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import api from "./api.service";

interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  deviceType: string;
  backedUp: boolean;
}

const passkeyService = {
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === "function"
    );
  },

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      // eslint-disable-next-line no-undef
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  async checkUserHasPasskeys(emailOrUsername: string): Promise<boolean> {
    try {
      const response = await api.get(`/auth/passkey/check/${encodeURIComponent(emailOrUsername)}`);
      return response.data.hasPasskeys;
    } catch {
      return false;
    }
  },

  async registerPasskey(name?: string): Promise<{ success: boolean; passkeyId?: string; error?: string }> {
    try {
      const optionsResponse = await api.post("/auth/passkey/register/options");
      const options = optionsResponse.data;

      const attestationResponse = await startRegistration({ optionsJSON: options });

      const verifyResponse = await api.post("/auth/passkey/register", {
        response: attestationResponse,
        name,
      });

      return {
        success: true,
        passkeyId: verifyResponse.data.passkeyId,
      };
    } catch (error: any) {
      console.error("Passkey registration failed:", error);
      
      if (error.name === "NotAllowedError") {
        return { success: false, error: "Registration was cancelled" };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Registration failed",
      };
    }
  },

  async authenticateWithPasskey(emailOrUsername?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const optionsResponse = await api.post("/auth/passkey/login/options", {
        emailOrUsername,
      });
      const { challengeKey, ...options } = optionsResponse.data;

      const assertionResponse = await startAuthentication({ optionsJSON: options });

      await api.post("/auth/passkey/login", {
        response: assertionResponse,
        challengeKey,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Passkey authentication failed:", error);
      
      if (error.name === "NotAllowedError") {
        return { success: false, error: "Authentication was cancelled" };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || "Authentication failed",
      };
    }
  },

  async listPasskeys(): Promise<PasskeyInfo[]> {
    try {
      const response = await api.get("/auth/passkey/list");
      return response.data;
    } catch {
      return [];
    }
  },

  async renamePasskey(passkeyId: string, name: string): Promise<boolean> {
    try {
      await api.patch(`/auth/passkey/${passkeyId}`, { name });
      return true;
    } catch {
      return false;
    }
  },

  async deletePasskey(passkeyId: string): Promise<boolean> {
    try {
      await api.delete(`/auth/passkey/${passkeyId}`);
      return true;
    } catch {
      return false;
    }
  },
};

export default passkeyService;
