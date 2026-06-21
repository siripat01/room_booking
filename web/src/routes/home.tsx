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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Search,
  Users,
  Building2,
  Wifi,
  Monitor,
  Wind,
  PenSquare,
  Tv,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/home")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData(sessionQuery());
    if (!user) throw redirect({ to: "/" });
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(roomsQuery()),
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

const CAPACITY_FILTERS = [
  { label: "Any", value: 0 },
  { label: "1–5", value: 5 },
  { label: "6–10", value: 10 },
  { label: "11–20", value: 20 },
  { label: "20+", value: 999 },
];

function HomePage() {
  const { user } = useCurrentUser();
  const { data: rooms = [], isLoading: loading } = useQuery(roomsQuery());
  const [search, setSearch] = useState("");
  const [capacityFilter, setCapacityFilter] = useState(0);
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);
  const [floorFilter, setFloorFilter] = useState("");

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort();
  const allAmenities = Array.from(new Set(rooms.flatMap((r) => r.amenities)));

  const filtered = rooms.filter((room) => {
    if (!room.isActive) return false;
    if (search && !room.name.toLowerCase().includes(search.toLowerCase()) &&
      !room.floor.toLowerCase().includes(search.toLowerCase())) return false;
    if (capacityFilter && room.capacity > capacityFilter) return false;
    if (floorFilter && room.floor !== floorFilter) return false;
    if (amenityFilter.length > 0 && !amenityFilter.every((a) => room.amenities.includes(a))) return false;
    return true;
  });

  function toggleAmenity(a: string) {
    setAmenityFilter((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  const displayRooms = filtered;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Find a Room</h1>
          <p className="text-muted-foreground">Browse and book available meeting rooms</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms or floors…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {floors.length > 0 && (
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
            )}
          </div>

          {/* Capacity filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Capacity:
            </span>
            {CAPACITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setCapacityFilter(capacityFilter === f.value ? 0 : f.value)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  capacityFilter === f.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground/40"
                }`}
              >
                {f.label}
              </button>
            ))}
            {allAmenities.length > 0 && (
              <>
                <span className="text-muted-foreground mx-1">|</span>
                {allAmenities.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border transition-colors ${
                      amenityFilter.includes(a)
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    {AMENITY_ICONS[a]}
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card h-56 animate-pulse" />
            ))}
          </div>
        ) : displayRooms.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No rooms found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow group">
      {/* Placeholder image area */}
      <div className="h-40 bg-gradient-to-br from-secondary to-muted rounded-t-lg flex items-center justify-center text-muted-foreground/30 overflow-hidden">
        <Building2 className="w-16 h-16" />
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{room.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-xs">
            Floor {room.floor}
          </Badge>
        </div>
        {room.description && (
          <CardDescription className="line-clamp-2 text-xs">{room.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3 flex-1">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <Users className="w-3.5 h-3.5" />
          <span>Up to {room.capacity} people</span>
        </div>
        {room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {AMENITY_ICONS[a]}
                {AMENITY_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild className="w-full" size="sm">
          <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
            View & Book
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

const DEMO_ROOMS: Room[] = [
  {
    id: "demo-1",
    name: "Conference Room A",
    description: "Spacious main conference room with full AV setup.",
    capacity: 20,
    floor: "3",
    amenities: ["projector", "whiteboard", "ac", "wifi"],
    isActive: true,
  },
  {
    id: "demo-2",
    name: "Meeting Room B",
    description: "Cozy room ideal for small team discussions.",
    capacity: 8,
    floor: "2",
    amenities: ["tv", "whiteboard", "ac"],
    isActive: true,
  },
  {
    id: "demo-3",
    name: "Board Room",
    description: "Executive board room with premium furniture.",
    capacity: 12,
    floor: "5",
    amenities: ["projector", "tv", "ac", "wifi"],
    isActive: true,
  },
  {
    id: "demo-4",
    name: "Collaboration Hub",
    description: "Open collaboration space for creative sessions.",
    capacity: 6,
    floor: "1",
    amenities: ["whiteboard", "wifi"],
    isActive: true,
  },
  {
    id: "demo-5",
    name: "Training Room",
    description: "Large room equipped for training and workshops.",
    capacity: 30,
    floor: "4",
    amenities: ["projector", "whiteboard", "ac", "wifi"],
    isActive: true,
  },
  {
    id: "demo-6",
    name: "Focus Room",
    description: "Quiet private space for focused work or 1-on-1s.",
    capacity: 4,
    floor: "2",
    amenities: ["ac", "wifi"],
    isActive: true,
  },
];
