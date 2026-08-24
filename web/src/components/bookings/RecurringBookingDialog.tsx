import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const WEEKDAYS = [
  ["MONDAY", "Mon"],
  ["TUESDAY", "Tue"],
  ["WEDNESDAY", "Wed"],
  ["THURSDAY", "Thu"],
  ["FRIDAY", "Fri"],
  ["SATURDAY", "Sat"],
  ["SUNDAY", "Sun"],
] as const;

type Weekday = (typeof WEEKDAYS)[number][0];

type Preview = {
  occurrenceCount: number;
  validOccurrences: Array<{ date: string; startTime: string; endTime: string }>;
  conflicts: Array<{
    date: string;
    code: string;
    message: string;
    suggestedAlternatives: Array<{
      rank: number;
      reason: string;
      roomName: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  canCreateAtomically: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  startDate: string;
  startTime: string;
  endTime: string;
  attendees: number;
  purpose: string;
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayForDate(date: string): Weekday {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][day] as Weekday;
}

async function request<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error ?? "Recurring booking request failed") as Error & {
      code?: string;
      conflicts?: Preview["conflicts"];
    };
    error.code = data?.code;
    error.conflicts = data?.conflicts;
    throw error;
  }
  return data as T;
}

export function RecurringBookingDialog({
  open,
  onOpenChange,
  roomId,
  startDate,
  startTime,
  endTime,
  attendees,
  purpose,
}: Props) {
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState(addDays(startDate, 28));
  const [weekdays, setWeekdays] = useState<Weekday[]>([weekdayForDate(startDate)]);
  const [preview, setPreview] = useState<Preview | null>(null);

  const body = useMemo(() => ({
    roomId,
    startDate,
    endDate,
    weekdays,
    startTime,
    endTime,
    attendees,
    purpose: purpose.trim() || undefined,
  }), [attendees, endDate, endTime, purpose, roomId, startDate, startTime, weekdays]);

  useEffect(() => {
    if (!open) return;
    setEndDate(addDays(startDate, 28));
    setWeekdays([weekdayForDate(startDate)]);
    setPreview(null);
  }, [open, startDate]);

  useEffect(() => setPreview(null), [body]);

  const previewMutation = useMutation({
    mutationFn: () => request<Preview>("/api/booking-series/preview", body),
    onSuccess: setPreview,
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not preview recurring booking"),
  });

  const createMutation = useMutation({
    mutationFn: () => request<{ id: string }>("/api/booking-series", body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["booking-series"] }),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      ]);
      toast.success("Recurring booking created.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create recurring booking"),
  });

  const toggleWeekday = (weekday: Weekday) => {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((value) => value !== weekday)
        : [...current, weekday],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-violet-600" /> Weekly recurring booking
          </DialogTitle>
          <DialogDescription>
            Pro feature. All occurrences are created together only when every date passes the booking policy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <span className="font-medium">First date:</span> {startDate}
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-medium">Time:</span> {startTime}–{endTime}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-end-date">Repeat until</Label>
            <Input
              id="recurring-end-date"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Weekdays</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={weekdays.includes(value) ? "default" : "outline"}
                  className={weekdays.includes(value) ? "bg-violet-600 hover:bg-violet-700" : ""}
                  onClick={() => toggleWeekday(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {preview && (
            <div className={`rounded-lg border p-4 ${preview.canCreateAtomically ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-sm">
                  {preview.occurrenceCount} occurrence{preview.occurrenceCount === 1 ? "" : "s"}
                </p>
                <Badge variant={preview.canCreateAtomically ? "success" : "warning"}>
                  {preview.canCreateAtomically ? "Ready" : `${preview.conflicts.length} conflict(s)`}
                </Badge>
              </div>
              {preview.conflicts.length > 0 && (
                <div className="mt-3 space-y-3">
                  {preview.conflicts.map((conflict) => (
                    <div key={`${conflict.date}-${conflict.code}`} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                      <p className="font-medium text-amber-800">{conflict.date}: {conflict.message}</p>
                      {conflict.suggestedAlternatives.slice(0, 3).map((alternative) => (
                        <p key={`${alternative.roomName}-${alternative.startTime}`} className="mt-1 text-xs text-amber-700">
                          <Sparkles className="inline w-3 h-3 mr-1" />
                          {alternative.roomName}, {new Date(alternative.startTime).toLocaleString("en-GB", {
                            timeZone: "Asia/Bangkok",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!endDate || weekdays.length === 0 || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Preview conflicts
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={!preview?.canCreateAtomically || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create series
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
