import React, { useState } from "react";
import logo from "../components/images/logo.png";
import background from "../components/images/login.jpg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setMessage("");

    try {
      // Use the authentication service to verify credentials
      const result = await authService.login({ username, password });

      if (result.success && result.user) {
        // Login successful
        login(result.user);
        setMessage("Login successful! Redirecting...");

        // Redirect based on role
        setTimeout(() => {
          if (result.user!.role === "admin") {
            navigate("/admin");
          } else {
            navigate("/"); // School head dashboard
          }
        }, 1000);
      } else {
        // Login failed
        setMessage(
          result.message ||
            result.error ||
            "Invalid credentials. Please try again."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-gray-100 bg-cover bg-center p-4"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="flex flex-col md:flex-row max-w-3xl w-full bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Left Panel (Blue Section) - Moves on top in mobile */}
        <div className="bg-[#010662] text-white text-center p-10 flex flex-col justify-center items-center md:w-1/2 w-full">
          <img src={logo} className="w-28 mb-4" alt="SPCC Logo" />
          <h1 className="font-extrabold text-4xl mb-2">SPCC</h1>
          <p className="text-lg">Systems Plus Computer College</p>
          <p className="text-xs mt-auto">
            &copy; 2025 SPCC. All rights reserved.
          </p>
        </div>

        {/* Right Panel (White Section) - Moves below in mobile */}
        <div className="bg-white p-10 flex-1 w-full md:w-1/2">
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-gray-600 mb-6">
            Enter your credentials to access your account
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="username" className="font-semibold block mb-1">
                Username or Email
              </label>
              <input
                type="text"
                id="username"
                placeholder="Enter Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="font-semibold block mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
              {/*<a
                href="#"
                className="text-sm text-[#010662] hover:underline block mt-2"
              >
                Forgot password?
              </a>*/}
            </div>

            <button
              type="submit"
              className="w-full p-3 bg-[#010662] text-white rounded-md hover:bg-[#020a94] transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Demo Credentials 
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Demo Credentials:
            </p>
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <strong>Admin:</strong> username: admin, password: admin123
              </p>
              <p>
                <strong>School Heads:</strong> Use credentials created by admin
                in School Head Management
              </p>
              <p className="text-xs text-blue-600 mt-2">
                💡 Tip: Admin can create school head accounts that can be used
                to log in
              </p>
            </div>
          </div>
*/}
          {message && (
            <p
              className={`mt-4 text-center ${
                message.includes("error") ||
                message.includes("Please select") ||
                message.includes("Invalid")
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
