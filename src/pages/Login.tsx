import React, { useState, useRef, useEffect } from "react";
import logo from "../components/images/logo.png";
import background from "../components/images/login.jpg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";

type RolePick = "admin" | "school_head";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rolePick, setRolePick] = useState<RolePick>("school_head"); // default to acad head
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (redirectTimer.current) window.clearTimeout(redirectTimer.current); };
  }, []);

  useEffect(() => {
    if (message) { setIsError(false); setMessage(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password, rolePick]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ("getModifierState" in e) {
      const on = (e as any).getModifierState?.("CapsLock");
      if (typeof on === "boolean") setCapsLockOn(on);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    const uname = username.trim();
    const pwd = password;

    if (!uname || !pwd) {
      setIsError(true);
      setMessage("Please enter your username and password.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      // Call the specific endpoint based on selected role
      const result =
        rolePick === "admin"
          ? await authService.verifyAdminCredentials({ username: uname, password: pwd })
          : await authService.verifySchoolHeadCredentials({ username: uname, password: pwd });

      if (result.success && result.user) {
        login(result.user);
        setMessage(`Login successful as ${rolePick === "admin" ? "Admin" : "Acad Head"}! Redirecting...`);
        const to = result.user.role === "admin" ? "/admin" : "/";
        redirectTimer.current = window.setTimeout(() => navigate(to), 600);
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

          {/* Role selector */}
          <div className="mb-5">
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setRolePick("school_head")}
                className={`px-4 py-2 text-sm font-medium ${
                  rolePick === "school_head"
                    ? "bg-[#010662] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Acad Head
              </button>
              <button
                type="button"
                onClick={() => setRolePick("admin")}
                className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${
                  rolePick === "admin"
                    ? "bg-[#010662] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Admin
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              You’re logging in as <span className="font-semibold">{rolePick === "admin" ? "Admin" : "Acad Head"}</span>.
            </p>
          </div>

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
                onKeyDown={handleKeyDown}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
                autoCapitalize="none"
                autoComplete="username"
                inputMode="email"
              />
            </div>

            <div className="mb-2">
              <label htmlFor="password" className="font-semibold block mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {capsLockOn && (
              <p className="text-xs text-amber-600 mb-3">Caps Lock is ON</p>
            )}

            <button
                type="submit"
                className="w-full p-3 bg-[#010662] text-white rounded-md hover:bg-[#020a94] transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  `Sign in as ${rolePick === "admin" ? "Admin" : "Acad Head"}`
                )}
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
