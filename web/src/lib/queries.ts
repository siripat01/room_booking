import { apiUrl, app } from "./api";
import { authClient } from "./auth";
import type { UserRole } from "./useCurrentUser";

const THIRTY_SECONDS = 30_000;
const FIVE_MINUTES = 5 * 60_000;
const THIRTY_MINUTES = 30 * 60_000;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const sessionQuery = () => ({
  queryKey: ["session"],
  queryFn: async () => {
    let s: Awaited<ReturnType<typeof authClient.getSession>>;
    try { s = await authClient.getSession(); } catch { return null; }
    if (!s.data?.user) return null;
    const u = s.data.user as any;
    const role: UserRole = u.role ?? "userRole";
    return {
      id: u.id as string,
      name: u.name as string,
      email: u.email as string,
      image: u.image as string | null,
      role,
      isAdmin: role === "adminRole",
      isTeacher: role === "teacherRole",
      isStudent: role === "userRole",
      banned: (u.banned as boolean | null) ?? false,
      banReason: (u.banReason as string | null) ?? null,
      plan: (u.plan as string | null) ?? "FREE",
    };
  },
  staleTime: FIVE_MINUTES,
});

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const roomsQuery = () => ({
  queryKey: ["rooms"],
  queryFn: async () => {
    const { data, error } = await app.api.rooms.get();
    if (error) throw error;
    return data as Room[];
  },
  staleTime: FIVE_MINUTES,
  gcTime: THIRTY_MINUTES,
});

export const roomQuery = (id: string) => ({
  queryKey: ["rooms", id],
  queryFn: async () => {
    const { data, error } = await (app.api.rooms as any)[id].get();
    if (error) throw error;
    return data as Room;
  },
  staleTime: FIVE_MINUTES,
  gcTime: THIRTY_MINUTES,
});

export const roomAvailabilityQuery = (id: string, date: string) => ({
  queryKey: ["rooms", id, "availability", date],
  queryFn: async () => {
    const { data, error } = await (app.api.rooms as any)[id].availability.get({ query: { date } });
    if (error) throw error;
    return data as RoomAvailability;
  },
  staleTime: THIRTY_SECONDS,
});

// ── Bookings ──────────────────────────────────────────────────────────────────

export const bookingsQuery = (params?: { status?: string; page?: number }) => ({
  queryKey: ["bookings", params],
  queryFn: async () => {
    const { data, error } = await (app.api.bookings as any).get({
      query: {
        status: params?.status,
        page: params?.page?.toString(),
        forSelf: "true",
      },
    });
    if (error) throw error;
    return data as BookingListResponse;
  },
  staleTime: THIRTY_SECONDS,
});

export const bookingQuery = (id: string) => ({
  queryKey: ["bookings", id],
  queryFn: async () => {
    const { data, error } = await (app.api.bookings as any)[id].get();
    if (error) throw error;
    return data as Booking;
  },
  staleTime: THIRTY_SECONDS,
});

export const bookingSeriesQuery = () => ({
  queryKey: ["booking-series"],
  queryFn: async () => {
    const response = await fetch(apiUrl("/api/booking-series"), { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch recurring bookings");
    return response.json() as Promise<BookingSeries[]>;
  },
  staleTime: THIRTY_SECONDS,
});

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminBookingsQuery = (
  params: { status?: string; page?: number; search?: string } = {},
) => {
  const status = params.status ?? "";
  const page = params.page ?? 1;
  const search = params.search?.trim() ?? "";

  return {
    queryKey: ["admin", "bookings", status, page, search],
    queryFn: async () => {
      const { data, error } = await (app.api.bookings as any).get({
        query: {
          status: status || undefined,
          page: page.toString(),
          limit: "30",
          search: search || undefined,
        },
      });
      if (error) throw error;
      return data as BookingListResponse;
    },
    staleTime: THIRTY_SECONDS,
  };
};

export const bookingTimelineQuery = (id: string | null) => ({
  queryKey: ["admin", "bookings", id, "timeline"],
  enabled: Boolean(id),
  queryFn: async () => {
    if (!id) return [] as BookingTimelineEvent[];
    const response = await fetch(apiUrl(`/api/bookings/${encodeURIComponent(id)}/timeline`), {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load booking timeline");
    return response.json() as Promise<BookingTimelineEvent[]>;
  },
  staleTime: THIRTY_SECONDS,
});

export const adminUsersQuery = (
  params: { search?: string; role?: string; page?: number } = {},
) => {
  const search = params.search?.trim() ?? "";
  const role = params.role ?? "";
  const page = params.page ?? 1;

  return {
    queryKey: ["admin", "users", search, role, page],
    queryFn: async () => {
      const { data, error } = await (app.api.users as any).get({
        query: {
          search: search || undefined,
          role: role || undefined,
          page: page.toString(),
          limit: "20",
        },
      });
      if (error) throw error;
      return data as UserListResponse;
    },
    staleTime: THIRTY_SECONDS,
  };
};

export const adminStatsQuery = () => ({
  queryKey: ["admin", "stats"],
  queryFn: async () => {
    const { data, error } = await (app.api.bookings as any).stats.get();
    if (error) throw error;
    return data as AdminStats;
  },
  staleTime: THIRTY_SECONDS,
});

export const adminDashboardQuery = () => ({
  queryKey: ["admin-dashboard"],
  queryFn: async () => {
    const { data, error } = await (app.api.reports as any).dashboard.get();
    if (error) throw error;
    return data as {
      stats: { totalRooms: number; pendingBookings: number; totalUsers: number; confirmedToday: number };
      bookings: BookingListResponse;
      overview: { popularRooms: { room?: { name: string; floor: string }; bookingCount: number }[] };
      summary: { daily: { date: string; count: number }[] };
      peakHours: { hour: number; label: string; count: number }[];
    };
  },
  staleTime: THIRTY_SECONDS,
});

export const devicesQuery = () => ({
  queryKey: ["admin", "devices"],
  queryFn: async () => {
    const { data, error } = await (app.api as any).devices.get();
    if (error) throw error;
    return data as AdminDevice[];
  },
  staleTime: THIRTY_SECONDS,
});

export const reportsOverviewQuery = (from?: string, to?: string) => ({
  queryKey: ["reports", "overview", from, to],
  queryFn: async () => {
    const { data, error } = await (app.api.reports as any).overview.get({ query: { from, to } });
    if (error) throw error;
    return data as ReportsOverview;
  },
  staleTime: THIRTY_SECONDS,
});

export const reportsBookingsSummaryQuery = (from?: string, to?: string) => ({
  queryKey: ["reports", "bookings-summary", from, to],
  queryFn: async () => {
    const { data, error } = await (app.api.reports as any)["bookings-summary"].get({ query: { from, to } });
    if (error) throw error;
    return data as { byStatus: { status: string; count: number }[]; daily: { date: string; count: number }[] };
  },
  staleTime: THIRTY_SECONDS,
});

export const reportsPeakHoursQuery = (from?: string, to?: string) => ({
  queryKey: ["reports", "peak-hours", from, to],
  queryFn: async () => {
    const { data, error } = await (app.api.reports as any)["peak-hours"].get({ query: { from, to } });
    if (error) throw error;
    return data as { hour: number; label: string; count: number }[];
  },
  staleTime: THIRTY_SECONDS,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type Room = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  floor: string;
  amenities: string[];
  allowedRoles: string[];
  isActive: boolean;
  autoApprove: boolean;
};

export type RoomAvailability = {
  room: { id: string; name: string; capacity: number; floor: string };
  date: string;
  openTime: string | null;
  closeTime: string | null;
  bookings: { startTime: string; endTime: string; status: string }[];
};

export type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "REJECTED" | "EXPIRED";

export type Booking = {
  id: string;
  roomId: string;
  userId: string;
  room?: { name: string; floor: string };
  user?: { name: string; email: string; image?: string | null };
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string | null;
  status: BookingStatus;
  cancelReason?: string | null;
  rejectedReason?: string | null;
  qrExpiresAt?: string | null;
  checkInWindow?: { opensAt: string; closesAt: string };
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  createdAt: string;
};

export type BookingListResponse = {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type BookingSeries = {
  id: string;
  roomId: string;
  room: { id: string; name: string; floor: string };
  startDate: string;
  endDate: string;
  weekdays: string[];
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string | null;
  status: "ACTIVE" | "CANCELLED";
  cancelledAt?: string | null;
  _count: { bookings: number };
};

export type BookingTimelineEvent = {
  id: string;
  actorType: "USER" | "ADMIN" | "DEVICE" | "SYSTEM";
  actorId?: string | null;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
  createdAt: string;
};

export type UserListResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: string;
  _count?: { bookings: number };
};

export type AdminStats = {
  totalRooms: number;
  pendingBookings: number;
  totalUsers: number;
  confirmedToday: number;
};

export type ReportsOverview = {
  totalRooms: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalUsers: number;
  popularRooms: { room: { id: string; name: string; floor: string }; bookingCount: number }[];
};

export type WaitlistEntry = {
  id: string;
  roomId: string;
  room: { name: string; floor: string };
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string | null;
  status: "WAITING" | "PROMOTED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
};

export const waitlistQuery = () => ({
  queryKey: ["waitlist"],
  queryFn: async () => {
    const res = await fetch(apiUrl("/api/bookings/waitlist"), { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch waitlist");
    return res.json() as Promise<WaitlistEntry[]>;
  },
  staleTime: THIRTY_SECONDS,
});

export type AdminDevice = {
  id: string;
  name: string;
  roomId?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  deviceKeyPrefix: string;
  credentialVersion: number;
  credentialRotatedAt: string;
  revokedAt?: string | null;
  onlineStatus: "online" | "offline" | "unknown";
  room?: { id: string; name: string; floor: string } | null;
};
