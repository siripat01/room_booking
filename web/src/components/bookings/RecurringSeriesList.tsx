import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Clock, Loader2, MapPin, Repeat2, Users } from "lucide-react";
import { toast } from "sonner";
import { bookingSeriesQuery, type BookingSeries } from "../../lib/queries";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const DAY_LABELS: Record<string, string> = {
  SUNDAY: "Sun",
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
};

export function RecurringSeriesList({ plan }: { plan?: string }) {
  const queryClient = useQueryClient();
  const { data: series = [], isLoading } = useQuery(bookingSeriesQuery());
  const cancelMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      const response = await fetch(`/api/booking-series/${encodeURIComponent(seriesId)}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "ENTIRE" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Could not cancel recurring booking");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["booking-series"] }),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      ]);
      toast.success("Recurring booking cancelled.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel recurring booking"),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading recurring bookings…</div>;
  }

  if (series.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
          <Repeat2 className="w-8 h-8 text-violet-400" />
        </div>
        <p className="font-semibold text-slate-700">No recurring bookings</p>
        <p className="text-sm mt-1">
          {plan === "PRO" ? "Choose a room and use weekly recurring booking." : "Creating recurring bookings requires an active Pro plan."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plan !== "PRO" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your Pro access has ended. Existing history remains visible, but creating or editing a series requires Pro.
        </div>
      )}
      {series.map((item) => (
        <SeriesCard
          key={item.id}
          series={item}
          cancelling={cancelMutation.isPending && cancelMutation.variables === item.id}
          onCancel={() => cancelMutation.mutate(item.id)}
        />
      ))}
    </div>
  );
}

function SeriesCard({
  series,
  cancelling,
  onCancel,
}: {
  series: BookingSeries;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const startDate = series.startDate.slice(0, 10);
  const endDate = series.endDate.slice(0, 10);
  return (
    <div className="bg-white rounded-xl border border-l-4 border-l-violet-400 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <h3 className="font-semibold text-slate-900">{series.room.name}</h3>
            <Badge variant={series.status === "ACTIVE" ? "success" : "outline"}>{series.status}</Badge>
            <Badge variant="secondary">{series._count.bookings} occurrence(s)</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-violet-500" />
              {startDate} – {endDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              {series.startTime}–{series.endTime}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-violet-500" />
              {series.attendees}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-violet-500" />
              Floor {series.room.floor}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {series.weekdays.map((day) => DAY_LABELS[day] ?? day).join(", ")}
            {series.purpose ? ` · ${series.purpose}` : ""}
          </p>
        </div>
        {series.status === "ACTIVE" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel series"}
          </Button>
        )}
      </div>
    </div>
  );
}
