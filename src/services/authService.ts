import { apiService, ApiResponse } from "./apiService";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    role: "admin" | "school_head";
    email?: string;
    name?: string;
  };
  message?: string;
  error?: string;
}

class AuthService {
  async verifyAdminCredentials(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.makeRequest<ApiResponse<any>>(
        "POST",
        "/admin/auth.php",
        credentials
      );
      const u = (response.data as any)?.user;
      if (response.success && u) {
        return {
          success: true,
          user: {
            id: u.id,
            username: u.username,
            role: "admin",
            email: u.email,
            name: u.name,
          },
        };
      }
      return {
        success: false,
        message: response.message || response.error || "Invalid admin credentials",
      };
    } catch (error) {
      console.error("Admin auth error:", error);
      return { success: false, error: "Failed to verify admin credentials" };
    }
  }

  async verifySchoolHeadCredentials(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.makeRequest<ApiResponse<any>>(
        "POST",
        "/auth_school_head.php",
        credentials
      );
      const u = (response.data as any)?.user;
      if (response.success && u) {
        return {
          success: true,
          user: {
            id: u.id,
            username: u.username,
            role: "school_head",
            email: u.email,
            name: u.name,
          },
        };
      }
      return { success: false, message: response.message || "Invalid username or password" };
    } catch (error) {
      console.error("School head auth error:", error);
      return { success: false, error: "Failed to verify credentials. Please try again." };
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const adminResult = await this.verifyAdminCredentials(credentials);
      if (adminResult.success) return adminResult;
      return await this.verifySchoolHeadCredentials(credentials);
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An error occurred during login. Please try again." };
    }
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
        return null;
      }
    }
    return null;
  }
}

export const authService = new AuthService();
export default authService;
