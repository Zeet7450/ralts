"use client";

import * as React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  stat?: string | number;
  className?: string;
}

export function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
  stat,
  className,
}: ModuleCardProps) {
  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          "h-full transition-colors hover:bg-surface-elevated hover:border-accent/30",
          className
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon
                  className="h-5 w-5 text-accent shrink-0"
                  strokeWidth={1.5}
                />
                <h3 className="font-medium text-text-primary truncate">{title}</h3>
              </div>
              <p className="text-sm text-text-secondary line-clamp-2">
                {description}
              </p>
            </div>
            {stat !== undefined && (
              <Badge variant="secondary" className="shrink-0">
                {stat}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
