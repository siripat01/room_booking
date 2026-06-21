import { useQuery } from "@tanstack/react-query";
import { sessionQuery } from "./queries";

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
  const { data: user, isLoading: loading } = useQuery(sessionQuery());
  return { user: user ?? null, loading };
}

export function roleLabel(role: UserRole | string | null | undefined): string {
  switch (role) {
    case "adminRole": return "Admin";
    case "teacherRole": return "Teacher";
    case "userRole": return "Student";
    default: return "Student";
  }
}
