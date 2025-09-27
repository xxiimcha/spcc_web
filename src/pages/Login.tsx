import React, { useState, useRef, useEffect } from "react";
import logo from "../components/images/logo.png";
import background from "../components/images/login.jpg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        window.clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const uname = username.trim();
    const pwd = password; // keep exact; don’t trim passwords silently

    if (!uname || !pwd) {
      setIsError(true);
      setMessage("Please enter your username and password.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const result = await authService.login({ username: uname, password: pwd });

      if (result.success && result.user) {
        login(result.user);
        setIsError(false);
        setMessage("Login successful! Redirecting...");

        redirectTimer.current = window.setTimeout(() => {
          navigate(result.user!.role === "admin" ? "/admin" : "/");
        }, 800);
      } else {
        setIsError(true);
        setMessage(result.message || result.error || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setIsError(true);
      setMessage("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isLoading;

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-gray-100 bg-cover bg-center p-4"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="flex flex-col md:flex-row max-w-3xl w-full bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="bg-[#010662] text-white text-center p-10 flex flex-col justify-center items-center md:w-1/2 w-full">
          <img src={logo} className="w-28 mb-4" alt="SPCC Logo" />
          <h1 className="font-extrabold text-4xl mb-2">SPCC</h1>
          <p className="text-lg">Systems Plus Computer College</p>
          <p className="text-xs mt-auto">&copy; 2025 SPCC. All rights reserved.</p>
        </div>

        <div className="bg-white p-10 flex-1 w-full md:w-1/2">
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-gray-600 mb-6">Enter your credentials to access your account</p>

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
                autoCapitalize="none"
                autoComplete="username"
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
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="w-full p-3 bg-[#010662] text-white rounded-md hover:bg-[#020a94] transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {message && (
            <p className={`mt-4 text-center ${isError ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
