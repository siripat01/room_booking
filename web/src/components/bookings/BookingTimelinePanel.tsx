import { Badge } from "../ui/badge";
import { LoadingCentered } from "../LoadingSpinner";
import type { BookingTimelineEvent } from "../../lib/queries";

type BookingTimelinePanelProps = {
  events: BookingTimelineEvent[];
  isLoading?: boolean;
  isError?: boolean;
};

export function BookingTimelinePanel({
  events,
  isLoading = false,
  isError = false,
}: BookingTimelinePanelProps) {
  if (isLoading) {
    return (
      <div className="py-10" role="status" aria-label="Loading booking timeline">
        <LoadingCentered />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-red-600">Unable to load the audit timeline.</p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No audit events recorded.</p>
    );
  }

  return (
    <ol className="relative ml-2 border-l border-slate-200 space-y-6 py-2">
      {events.map((event) => (
        <li key={event.id} className="ml-5">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-slate-900">
              {event.eventType.replaceAll("_", " ")}
            </span>
            {event.newStatus && (
              <Badge variant="outline" className="text-[10px]">
                {event.previousStatus ? `${event.previousStatus} → ` : ""}
                {event.newStatus}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleString("en-GB", {
              timeZone: "Asia/Bangkok",
              dateStyle: "medium",
              timeStyle: "medium",
            })}{" "}
            · {event.actorType}
            {event.actorId ? ` (${event.actorId})` : ""}
          </p>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          )}
          {event.correlationId && (
            <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
              correlation: {event.correlationId}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
