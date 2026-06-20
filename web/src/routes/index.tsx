// src/routes/index.tsx
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${import.meta.env.VITE_FRONTEND_URL}/home`,
      });
    } catch {
      toast.error("Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-background rounded-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-foreground">
              <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
            </svg>
          </div>
          <span className="text-background font-semibold text-lg">Room Booking</span>
        </div>

        <div>
          <h1 className="text-background text-4xl font-bold leading-tight mb-4">
            Book your perfect<br />meeting space
          </h1>
          <p className="text-background/60 text-lg">
            Easily reserve rooms, manage your schedule, and collaborate with your team — all in one place.
          </p>
        </div>

        <div className="flex gap-6 text-background/50 text-sm">
          <div>
            <div className="text-background text-2xl font-bold">50+</div>
            <div>Rooms available</div>
          </div>
          <div>
            <div className="text-background text-2xl font-bold">24/7</div>
            <div>Accessible</div>
          </div>
          <div>
            <div className="text-background text-2xl font-bold">Instant</div>
            <div>Confirmation</div>
          </div>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-foreground rounded-md flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-background">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
              </svg>
            </div>
            <span className="font-semibold text-lg">Room Booking</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to manage your room bookings</p>

          <div className="space-y-3">
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              variant="outline"
              className="w-full h-12 gap-3 text-base font-medium"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {loading ? "Signing in…" : "Continue with Google"}
            </Button>
          </div>

          <p className="text-center text-muted-foreground text-sm mt-8">
            By signing in, you agree to our{" "}
            <span className="underline cursor-pointer hover:text-foreground">Terms of Service</span>
            {" "}and{" "}
            <span className="underline cursor-pointer hover:text-foreground">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
