import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  User,
  Mail,
  Shield,
  LogOut,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  createdAt?: string;
};

function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s.data?.user) {
        window.location.href = "/";
        return;
      }
      setUser(s.data.user as unknown as SessionUser);
      setLoading(false);
    });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      toast.success("Signed out successfully");
      router.navigate({ to: "/" });
    } catch {
      toast.error("Sign out failed.");
      setSigningOut(false);
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={null} />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold mb-6">Profile</h1>

        <Card>
          <CardContent className="pt-8 pb-6">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-border mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-bold ring-4 ring-border mb-4">
                  {initials}
                </div>
              )}
              <h2 className="text-xl font-semibold">{user?.name}</h2>
              {user?.role && (
                <Badge variant={user.role === "admin" ? "default" : "secondary"} className="mt-1.5">
                  <Shield className="w-3 h-3 mr-1" />
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              )}
            </div>

            <Separator className="mb-6" />

            {/* Info rows */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Full name</p>
                  <p className="font-medium">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email address</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>

              {memberSince && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Member since</p>
                    <p className="font-medium">{memberSince}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            {/* Sign out */}
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              {signingOut ? "Signing out…" : "Sign Out"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
