import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { roomsQuery, sessionQuery, type Room } from "../lib/queries";
import { Navbar } from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Search, Users, Building2, Wifi, Monitor, Wind, PenSquare, Tv, SlidersHorizontal, Lock,
} from "lucide-react";

export const Route = createFileRoute("/home")({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (user) {
        localStorage.setItem("rb_authed", "1");
      } else {
        localStorage.removeItem("rb_authed");
        throw redirect({ to: "/", search: { redirect: location.pathname } });
      }
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      localStorage.removeItem("rb_authed");
      throw redirect({ to: "/", search: { redirect: location.pathname } });
    }
  },
  loader: ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    return queryClient.ensureQueryData(roomsQuery());
  },
  component: HomePage,
});

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  projector: <Monitor className="w-3.5 h-3.5" />,
  whiteboard: <PenSquare className="w-3.5 h-3.5" />,
  tv: <Tv className="w-3.5 h-3.5" />,
  ac: <Wind className="w-3.5 h-3.5" />,
  wifi: <Wifi className="w-3.5 h-3.5" />,
};

const AMENITY_LABELS: Record<string, string> = {
  projector: "Projector",
  whiteboard: "Whiteboard",
  tv: "TV",
  ac: "AC",
  wifi: "Wi-Fi",
};

type CapFilter = { min: number; max: number };
const NO_CAP: CapFilter = { min: 0, max: Infinity };

const CAPACITY_FILTERS: { label: string; filter: CapFilter }[] = [
  { label: "Any size", filter: NO_CAP },
  { label: "1–5",     filter: { min: 1, max: 5 } },
  { label: "6–10",    filter: { min: 6, max: 10 } },
  { label: "11–20",   filter: { min: 11, max: 20 } },
  { label: "20+",     filter: { min: 21, max: Infinity } },
];

const CARD_GRADIENTS = [
  "from-blue-500 to-blue-700",
  "from-violet-500 to-violet-700",
  "from-emerald-500 to-emerald-700",
  "from-sky-500 to-sky-700",
  "from-indigo-500 to-indigo-700",
  "from-teal-500 to-teal-700",
];

function roomGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length];
}

const ROLE_LABELS: Record<string, string> = {
  teacherRole: "Teachers",
  adminRole:   "Admins",
  userRole:    "Students",
};

function HomePage() {
  const { user } = useCurrentUser();
  const { data: rooms = [], isLoading: loading } = useQuery(roomsQuery());
  const [search, setSearch] = useState("");
  const [capFilter, setCapFilter] = useState<CapFilter>(NO_CAP);
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);
  const [floorFilter, setFloorFilter] = useState("");

  const userRole = user?.isAdmin ? "adminRole" : user?.isTeacher ? "teacherRole" : "userRole";

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort();
  const allAmenities = Array.from(new Set(rooms.flatMap((r) => r.amenities)));

  const filtered = rooms.filter((room) => {
    if (!room.isActive) return false;
    if (search && !room.name.toLowerCase().includes(search.toLowerCase()) &&
      !room.floor.toLowerCase().includes(search.toLowerCase())) return false;
    if ((capFilter.min > 0 || capFilter.max !== Infinity) &&
      (room.capacity < capFilter.min || room.capacity > capFilter.max)) return false;
    if (floorFilter && room.floor !== floorFilter) return false;
    if (amenityFilter.length > 0 && !amenityFilter.every((a) => room.amenities.includes(a))) return false;
    return true;
  });

  function toggleAmenity(a: string) {
    setAmenityFilter((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function clearFilters() {
    setCapFilter(NO_CAP);
    setAmenityFilter([]);
    setFloorFilter("");
  }

  const isCapFiltered = capFilter.min > 0 || capFilter.max !== Infinity;
  const activeFiltersCount = (isCapFiltered ? 1 : 0) + amenityFilter.length + (floorFilter ? 1 : 0);

  const pillBase = "px-3 py-1 rounded-full text-xs border transition-colors font-medium";
  const pillActive = "bg-blue-600 text-white border-blue-600";
  const pillIdle = "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 bg-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Find a Room</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? "Loading rooms…" : `${rooms.filter(r => r.isActive).length} rooms available`}
          </p>
        </div>

        {/* Search + filters */}
        <div className="bg-white rounded-xl border p-4 mb-8 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rooms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Floor */}
            {floors.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5" /> Floor
                </span>
                {floors.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFloorFilter(floorFilter === f ? "" : f)}
                    className={`${pillBase} ${floorFilter === f ? pillActive : pillIdle}`}
                  >
                    {f}
                  </button>
                ))}
                <span className="text-slate-300 select-none">|</span>
              </>
            )}

            {/* Capacity */}
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Capacity
            </span>
            {CAPACITY_FILTERS.map((f) => {
              const selected = capFilter.min === f.filter.min && capFilter.max === f.filter.max;
              return (
                <button
                  key={f.label}
                  onClick={() => setCapFilter(selected ? NO_CAP : f.filter)}
                  className={`${pillBase} ${selected ? pillActive : pillIdle}`}
                >
                  {f.label}
                </button>
              );
            })}

            {/* Amenities */}
            {allAmenities.length > 0 && (
              <>
                <span className="text-slate-300 select-none">|</span>
                {allAmenities.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    className={`flex items-center gap-1.5 ${pillBase} ${
                      amenityFilter.includes(a) ? pillActive : pillIdle
                    }`}
                  >
                    {AMENITY_ICONS[a]}
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                ))}
              </>
            )}

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-white h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-semibold text-slate-700">No rooms found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
            {activeFiltersCount > 0 && (
              <Button variant="link" onClick={() => { clearFilters(); setSearch(""); }} className="mt-2 text-blue-600">
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((room) => (
              <RoomCard key={room.id} room={room} gradient={roomGradient(room.id)} userRole={userRole} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RoomCard({ room, gradient, userRole }: { room: Room; gradient: string; userRole: string }) {
  const canBook = !room.allowedRoles?.length || room.allowedRoles.includes(userRole);
  const restrictionLabel = !canBook && room.allowedRoles?.length
    ? room.allowedRoles.map((r) => ROLE_LABELS[r] ?? r).join(" & ") + " only"
    : null;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow group flex flex-col ${!canBook ? "opacity-75" : ""}`}>
      {/* Gradient header */}
      <div className={`h-36 bg-gradient-to-br ${gradient} flex items-end p-4 relative`}>
        <div className="absolute inset-0 opacity-10">
          <Building2 className="w-32 h-32 absolute -right-4 -top-4 text-white" />
        </div>
        <div className="relative flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
            Floor {room.floor}
          </Badge>
          {restrictionLabel && (
            <Badge className="bg-black/30 text-white border-transparent text-xs backdrop-blur-sm flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> {restrictionLabel}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
          {room.name}
        </h3>
        {room.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{room.description}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Users className="w-3.5 h-3.5" />
          <span>Up to <span className="font-medium text-slate-700">{room.capacity}</span> people</span>
        </div>

        {room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {room.amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {AMENITY_ICONS[a]}
                {AMENITY_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto">
          {canBook ? (
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm">
              <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
                View & Book
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full text-slate-500" size="sm">
              <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
                View Details
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
