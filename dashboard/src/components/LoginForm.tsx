"use client";

import React, { useState, useTransition } from "react";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

type AuthMode = "signin" | "signup";

export default function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Basic client validation
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    // Simulate authentication transition
    startTransition(async () => {
      await new Promise((res) => setTimeout(res, 1200));
      if (email === "error@test.com") {
        setError("Invalid credentials. Please verify your email and password.");
      } else {
        setSuccessMsg(
          mode === "signin"
            ? "Welcome back! Redirecting to your dashboard..."
            : "Account created successfully! Welcome aboard."
        );
      }
    });
  };

  const handleSocialLogin = (provider: "Google" | "GitHub") => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      await new Promise((res) => setTimeout(res, 1000));
      setSuccessMsg(`Authenticating with ${provider}... Redirecting...`);
    });
  };

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl transition-all sm:p-10">
      {/* Decorative ambient gradient backdrop */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />

      {/* Header section */}
      <div className="relative mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {mode === "signin"
            ? "Sign in with your email to access your workspace"
            : "Get started with your free developer account today"}
        </p>

        {/* Mode switcher tabs */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/70 p-1.5 ring-1 ring-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold tracking-wide transition-all ${
              mode === "signin"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold tracking-wide transition-all ${
              mode === "signup"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Status alerts */}
      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300 animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in slide-in-from-top-1"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* OAuth Social Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSocialLogin("Google")}
            className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs font-medium text-slate-200 shadow-sm transition hover:border-slate-700 hover:bg-slate-800/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
              />
            </svg>
            Google
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSocialLogin("GitHub")}
            className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs font-medium text-slate-200 shadow-sm transition hover:border-slate-700 hover:bg-slate-800/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4 shrink-0 fill-current text-slate-200" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            GitHub
          </button>
        </div>

        <div className="relative my-6 text-center text-xs">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-slate-900 px-3 text-slate-500 uppercase tracking-widest font-mono text-[10px]">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Main Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Full Name
            </label>
            <div className="relative">
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                disabled={isPending}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              disabled={isPending}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            {mode === "signin" && (
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Password reset instructions sent to your email.");
                }}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Forgot password?
              </a>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isPending}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-11 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-inner transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 font-mono tracking-wide"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {mode === "signin" && (
          <div className="flex items-center pt-1">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
              />
              <span className="text-xs text-slate-400">Remember this device</span>
            </label>
          </div>
        )}

        {mode === "signup" && (
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            By signing up, you agree to our{" "}
            <a href="#terms" className="text-indigo-400 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#privacy" className="text-indigo-400 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:from-indigo-400 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>{mode === "signin" ? "Sign in to account" : "Create account"}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer reassurance */}
      <div className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        <span>End-to-end encrypted session</span>
      </div>
    </div>
  );
}
