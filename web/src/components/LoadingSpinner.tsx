import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-muted-foreground", className)} />;
}

export function LoadingCentered({ className }: { className?: string }) {
  return (
    <div className="flex justify-center py-20">
      <LoadingSpinner className={cn("w-6 h-6", className)} />
    </div>
  );
}
