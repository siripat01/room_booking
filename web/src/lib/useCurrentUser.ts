import { useEffect, useState } from "react";
import { authClient } from "./auth";

export type UserRole = "userRole" | "teacherRole" | "adminRole";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
} | null;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s.data?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const u = s.data.user as any;
      const role: UserRole = u.role ?? "userRole";
      setUser({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        role,
        isAdmin: role === "adminRole",
        isTeacher: role === "teacherRole",
        isStudent: role === "userRole",
      });
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

export function roleLabel(role: UserRole | string | null | undefined): string {
  switch (role) {
    case "adminRole": return "Admin";
    case "teacherRole": return "Teacher";
    case "userRole": return "Student";
    default: return "Student";
  }
}
