import { apiService } from "./apiService";

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

interface SchoolHeadAuthData {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
  };
}

class AuthService {
  // Verify admin credentials (you can expand this to use a real admin table)
  async verifyAdminCredentials(
    credentials: LoginCredentials
  ): Promise<AuthResponse> {
    try {
      // For now, using hardcoded admin credentials
      // In production, you should create an admin table and verify against it
      if (
        credentials.username === "admin" &&
        credentials.password === "admin123"
      ) {
        return {
          success: true,
          user: {
            id: "1",
            username: "admin",
            role: "admin",
            email: "admin@spcc.edu.ph",
            name: "System Administrator",
          },
        };
      }

      return {
        success: false,
        message: "Invalid admin credentials",
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to verify admin credentials",
      };
    }
  }

  // Verify school head credentials against the database using existing endpoint
  async verifySchoolHeadCredentials(
    credentials: LoginCredentials
  ): Promise<AuthResponse> {
    try {
      // Use the API service for school head authentication
      const response = await apiService.makeRequest<SchoolHeadAuthData>(
        "POST",
        "/auth_school_head.php",
        credentials
      );

      if (response.success && response.data?.user) {
        return {
          success: true,
          user: {
            id: response.data.user.id,
            username: response.data.user.username,
            role: "school_head",
            email: response.data.user.email,
            name: response.data.user.name,
          },
        };
      } else {
        return {
          success: false,
          message: response.message || "Invalid username or password",
        };
      }
    } catch (error) {
      console.error("Error verifying school head credentials:", error);
      return {
        success: false,
        error: "Failed to verify credentials. Please try again.",
      };
    }
  }

  // Main login method that tries both admin and school head authentication
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // First try admin authentication
      const adminResult = await this.verifyAdminCredentials(credentials);
      if (adminResult.success) {
        return adminResult;
      }

      // If not admin, try school head authentication
      const schoolHeadResult = await this.verifySchoolHeadCredentials(
        credentials
      );
      return schoolHeadResult;
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "An error occurred during login. Please try again.",
      };
    }
  }

  // Logout method
  logout(): void {
    // Clear any stored authentication data
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("authToken");
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const user = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    return !!(user && role);
  }

  // Get current user from localStorage
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
