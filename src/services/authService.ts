// services/authService.ts
import { apiService, ApiResponse } from "./apiService";

export type RolePick = "admin" | "school_head";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: RolePick;
  email?: string;
  name?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
  error?: string;
}

const ENDPOINTS: Record<RolePick, string> = {
  admin: "/admin/auth.php",
  school_head: "/auth_school_head.php",
};

function parseBackend<T = any>(resp: ApiResponse<T> | any) {
  // success flag could be boolean OR status === "success"
  const ok = resp?.success === true || resp?.status === "success";
  // user could be resp.user OR resp.data.user
  const user = resp?.user ?? resp?.data?.user;
  const message =
    resp?.message ??
    resp?.error ??
    resp?.data?.message ??
    resp?.data?.error ??
    null;

  return { ok, user, message };
}

class AuthService {
  private async doAuth(
    role: RolePick,
    credentials: LoginCredentials
  ): Promise<AuthResponse> {
    try {
      const resp = await apiService.makeRequest<ApiResponse<any>>(
        "POST",
        ENDPOINTS[role],
        credentials
      );

      const { ok, user, message } = parseBackend(resp);

      if (ok && user) {
        const normalized: AuthUser = {
          id: String(user.id),
          username: user.username,
          role,
          email: user.email,
          name: user.name,
        };
        return { success: true, user: normalized };
      }

      return {
        success: false,
        message: message || `Invalid ${role === "admin" ? "admin" : "acad head"} credentials`,
      };
    } catch (err) {
      console.error(`${role} auth error:`, err);
      return {
        success: false,
        error: `Failed to verify ${role === "admin" ? "admin" : "acad head"} credentials`,
      };
    }
  }

  /** Explicit role login (use this when the UI has a role selector). */
  async loginAs(credentials: LoginCredentials, role: RolePick): Promise<AuthResponse> {
    return this.doAuth(role, credentials);
  }

  /** Backward-compatible:
   *  - If rolePick provided → use that role
   *  - Else auto-fallback: try admin, then school_head
   */
  async login(credentials: LoginCredentials, rolePick?: RolePick): Promise<AuthResponse> {
    try {
      if (rolePick) {
        return this.doAuth(rolePick, credentials);
      }
      const admin = await this.doAuth("admin", credentials);
      if (admin.success) return admin;
      return await this.doAuth("school_head", credentials);
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An error occurred during login. Please try again." };
    }
  }

  // Convenience wrappers (kept for compatibility with existing calls)
  async verifyAdminCredentials(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.doAuth("admin", credentials);
  }
  async verifySchoolHeadCredentials(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.doAuth("school_head", credentials);
  }

  logout(): void {
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("authToken");
  }

  isAuthenticated(): boolean {
    const user = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    return !!(user && role);
  }

  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    if (userStr && role) {
      try {
        const user = JSON.parse(userStr);
        return { ...user, role };
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
    return null;
  }
}

export const authService = new AuthService();
export default authService;
