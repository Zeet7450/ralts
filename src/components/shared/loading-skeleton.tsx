"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "card" | "list" | "text" | "avatar";
}

function Skeleton({ className, variant = "default", ...props }: SkeletonProps) {
  const baseClassName = "animate-pulse rounded-md bg-surface-elevated";

  const variantStyles = {
    default: "",
    card: "h-32 w-full",
    list: "h-16 w-full",
    text: "h-4 w-3/4",
    avatar: "h-10 w-10 rounded-full",
  };

  return (
    <div
      className={cn(baseClassName, variantStyles[variant], className)}
      {...props}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/2" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-5/6" />
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface">
          <Skeleton variant="avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="text" className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton variant="avatar" />
      <div className="space-y-2">
        <Skeleton variant="text" className="w-24" />
        <Skeleton variant="text" className="w-16" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonList,
  SkeletonText,
  SkeletonAvatar,
};
