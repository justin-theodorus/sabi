"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/Logo.png";

type Role = "learner" | "therapist" | null;
type Screen = "role" | "form";

export default function AuthPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("role");
  const [, setRole] = useState<Role>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleRoleSelect(r: Role) {
    setRole(r);
    setScreen("form");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      const userRole = data.user?.user_metadata?.role;
      router.push(
        userRole === "therapist" ? "/therapist/dashboard" : "/learner",
      );
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sabi-page items-center justify-center">
      <div className="sabi-centered">
        <Image src={logo} alt="SABI" height={240} priority className="mb-3" />
        <p
          className="text-sm mb-10 text-center"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Communication Training Platform
        </p>

        {screen === "role" ? (
          <div className="w-full flex gap-3">
            <button
              className="sabi-role-card flex-1"
              onClick={() => handleRoleSelect("learner")}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-surface-alt)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-7 h-7"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <span
                className="text-xs font-semibold text-center leading-tight"
                style={{ color: "var(--color-text)" }}
              >
                I'm a Learner
              </span>
            </button>

            <button
              className="sabi-role-card flex-1"
              onClick={() => handleRoleSelect("therapist")}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-surface-alt)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-7 h-7"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <span
                className="text-xs font-semibold text-center leading-tight"
                style={{ color: "var(--color-text)" }}
              >
                I'm a Therapist/
                <br />
                Caregiver
              </span>
            </button>
          </div>
        ) : (
          /* ── Screen 2: sign-in form ── */
          <form onSubmit={handleSignIn} className="w-full flex flex-col gap-3">
            <button
              type="button"
              className="sabi-back mb-1"
              onClick={() => {
                setScreen("role");
                setError(null);
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <input
              className="sabi-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
            />

            <input
              className="sabi-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
            />

            {error && (
              <p
                className="text-xs text-center px-2"
                style={{ color: "#ef4444" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sabi-btn-accent mt-1"
            >
              {loading ? "…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
