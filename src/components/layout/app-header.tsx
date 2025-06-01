"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Truck } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-headline font-semibold text-foreground">GorkhaTrans</h1>
      </div>
      {/* Add UserMenu or other header items here if needed */}
    </header>
  );
}
