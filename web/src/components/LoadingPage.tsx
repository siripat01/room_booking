export function LoadingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      {/* Top shimmer bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-border overflow-hidden">
        <div className="loading-shimmer absolute inset-y-0 w-1/3 bg-primary/60 rounded-full" />
      </div>

      {/* Center content */}
      <p className="text-xl font-semibold tracking-tight text-foreground">Room Booking</p>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className="loading-dots" aria-hidden>
          <span /><span /><span />
        </span>
        กำลังโหลด
      </div>
    </div>
  );
}
