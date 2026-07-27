"use client";

import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaimStatus } from "@/lib/api";

interface Step {
  key: string;
  label: string;
  statuses: ClaimStatus[];
}

const STEPS: Step[] = [
  { key: "pending", label: "Pending", statuses: ["pending", "validated", "queued"] },
  { key: "minting", label: "Minting", statuses: ["minting"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
];

function stepIndexFor(status: ClaimStatus): number {
  if (status === "completed") return 2;
  if (status === "minting") return 1;
  if (status === "failed") return -1;
  return 0;
}

export function CredentialStatus({
  status,
  failureReason,
}: {
  status: ClaimStatus;
  failureReason?: string | null;
}) {
  const failed = status === "failed";
  const activeIndex = stepIndexFor(status);

  return (
    <div>
      <ol className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isDone = !failed && (activeIndex > i || status === "completed");
          const isActive = !failed && activeIndex === i && status !== "completed";
          const isFailedHere = failed && i === 1;

          return (
            <li key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isDone &&
                      "border-emerald-500 bg-emerald-500 text-white",
                    isActive &&
                      "border-indigo-500 bg-indigo-50 text-indigo-600",
                    isFailedHere && "border-red-500 bg-red-50 text-red-600",
                    !isDone && !isActive && !isFailedHere &&
                      "border-slate-200 bg-white text-slate-300",
                  )}
                >
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : isFailedHere ? (
                    <X className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isDone && "text-emerald-600",
                    isActive && "text-indigo-600",
                    isFailedHere && "text-red-600",
                    !isDone && !isActive && !isFailedHere && "text-slate-400",
                  )}
                >
                  {isFailedHere ? "Failed" : step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 mb-6 h-0.5 flex-1 rounded",
                    isDone ? "bg-emerald-400" : "bg-slate-200",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      {failed && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {failureReason ?? "The mint failed. Please try again or contact the event organizer."}
        </p>
      )}
    </div>
  );
}
