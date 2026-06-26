import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "../lib/auth";
import { roleLabel, type UserRole } from "../lib/useCurrentUser";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { CalendarDays, Home, LogOut, Settings, User } from "lucide-react";
import { toast } from "sonner";

interface NavbarProps {
  user?: {
    name: string;
    email: string;
    image?: string | null;
    role?: UserRole | string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    localStorage.removeItem("rb_authed");
    toast.success("Signed out successfully");
    router.navigate({ to: "/" });
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const isAdmin = user?.role === "adminRole";
  const isTeacher = user?.role === "teacherRole";
  const isPro = (user as any)?.plan === "PRO";

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2.5 font-semibold text-lg shrink-0">
          <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-background">
              <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
            </svg>
          </div>
          <span className="hidden sm:inline">Room Booking</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            to="/home"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Rooms</span>
          </Link>
          <Link
            to="/bookings"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">My Bookings</span>
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </nav>

        {/* User menu */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {user.image ? (
                  <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                )}
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium max-w-32 truncate leading-tight">{user.name}</span>
                  {isPro && (
                    <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 leading-none">Pro</Badge>
                  )}
                  {!isPro && (isAdmin || isTeacher) && (
                    <Badge
                      variant={isAdmin ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0 h-4 leading-none"
                    >
                      {roleLabel(user.role)}
                    </Badge>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <Badge variant={isAdmin ? "default" : isTeacher ? "secondary" : "outline"} className="mt-1 text-xs">
                  {roleLabel(user.role)}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
