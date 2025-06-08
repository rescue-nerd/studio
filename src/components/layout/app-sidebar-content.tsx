"use client";

import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context'; // Import useAuth
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { supabase } from "@/lib/supabase";
import { cn } from '@/lib/utils';
import {
    ArchiveRestore,
    BarChartBig,
    BookMarked,
    BookOpenCheck,
    BookText,
    Building2, // Added LogIn icon
    Car,
    ClipboardList,
    FileText,
    Hash,
    LayoutDashboard,
    LogIn,
    LogOut,
    MapPin,
    PackageOpen,
    Receipt,
    Settings,
    Truck,
    Users2,
    Warehouse
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import React, { useEffect } from 'react';

const navStructure = [
  {
    groupLabel: null, 
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, authRequired: true },
    ]
  },
  {
    groupLabel: "Masters",
    items: [
      { href: '/branch-management', label: 'Branches', icon: Building2, authRequired: true },
      { href: '/locations', label: 'Locations & Units', icon: MapPin, authRequired: true },
      { href: '/trucks', label: 'Trucks', icon: Truck, authRequired: true },
      { href: '/drivers', label: 'Drivers', icon: Car, authRequired: true }, 
      { href: '/parties', label: 'Parties', icon: Users2, authRequired: true },
      { href: '/godowns', label: 'Godowns', icon: Warehouse, authRequired: true },
    ],
    authRequired: true,
  },
  {
    groupLabel: "Operations",
    items: [
      { href: '/invoicing', label: 'Bilti / Invoicing', icon: Receipt, authRequired: true },
      { href: '/manifests', label: 'Manifests', icon: ClipboardList, authRequired: true },
      { href: '/goods-receipt', label: 'Goods Receipt', icon: ArchiveRestore, authRequired: true },
      { href: '/goods-delivery', label: 'Goods Delivery', icon: PackageOpen, authRequired: true },
    ],
    authRequired: true,
  },
  {
    groupLabel: "Finance",
    items: [
      { href: '/ledgers', label: 'Ledgers', icon: BookMarked, authRequired: true },
      { href: '/daybook', label: 'Daybook', icon: BookOpenCheck, authRequired: true },
    ],
    authRequired: true,
  },
  {
    groupLabel: "Analytics & AI",
    items: [
      { href: '/reports', label: 'Reports', icon: BarChartBig, authRequired: true },
    ],
    authRequired: true,
  },
  {
    groupLabel: "Configuration",
    items: [
      { href: '/content-customization', label: 'Content Customization', icon: FileText, authRequired: true },
      { href: '/narration-setup', label: 'Narration Setup', icon: BookText, authRequired: true },
      { href: '/automatic-numbering', label: 'Automatic Numbering', icon: Hash, authRequired: true },
    ],
    authRequired: true,
  }
];

export default function AppSidebarContent() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Handle navigation in useEffect to avoid setState during render
  useEffect(() => {
    if (!loading && !user && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);
  
  if (loading && !user && (pathname !== '/login' && pathname !== '/signup')) {
    // Optionally, render a loading skeleton for the sidebar or nothing
    // If the app structure depends on user being loaded to show sidebar, this is fine.
    // Or redirect logic could be here, but better in a wrapper component or middleware.
    return null; // Don't render sidebar if loading and no user, unless on auth pages
  }

  if (!user && (pathname !== '/login' && pathname !== '/signup') ) {
    // If not loading, and no user, and not on an auth page, don't render the sidebar.
    // This assumes main content area will handle redirect or show a "please login" message.
    // A more robust solution for protected routes is usually middleware or a HOC.
    return null; 
  }


  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link
          href="/"
          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Truck className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
          <span className="font-headline text-2xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">GorkhaTrans</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        {navStructure.map((group, groupIndex) => {
          if (group.authRequired && !user) return null; // Hide group if auth required and no user
          return (
            <React.Fragment key={group.groupLabel || `group-${groupIndex}`}>
              {group.groupLabel && (
                <>
                  {groupIndex > 0 && <SidebarSeparator className="my-2" />}
                  <h3 className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden tracking-wider uppercase">
                    {group.groupLabel}
                  </h3>
                </>
              )}
              <SidebarMenu>
                {group.items.map((item) => {
                  if (item.authRequired && !user) return null; // Hide item if auth required and no user
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link href={item.href}>
                        <SidebarMenuButton
                          isActive={pathname === item.href}
                          tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
                          className={cn(
                            "justify-start",
                            pathname === item.href ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </React.Fragment>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <SidebarSeparator className="my-2" />
        <SidebarMenu>
            {user && (
              <SidebarMenuItem>
                   <Link href="/settings">
                      <SidebarMenuButton 
                          isActive={pathname === "/settings"}
                          tooltip={{ children: "Settings", side: 'right', className: 'bg-popover text-popover-foreground' }}
                          className={cn(
                              "justify-start",
                              pathname === "/settings" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                      >
                          <Settings className="h-5 w-5" />
                          <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                      </SidebarMenuButton>
                   </Link>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              {user ? (
                <SidebarMenuButton 
                    asChild
                    tooltip={{ children: "Logout", side: 'right', className: 'bg-popover text-popover-foreground' }}
                    className="justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                    <button onClick={handleSignOut}>
                        <LogOut className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                    </button>
                </SidebarMenuButton>
              ) : (
                 <Link href="/login">
                     <SidebarMenuButton 
                        isActive={pathname === "/login"}
                        tooltip={{ children: "Login", side: 'right', className: 'bg-popover text-popover-foreground' }}
                        className={cn(
                            "justify-start",
                            pathname === "/login" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                    >
                        <LogIn className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Login</span>
                    </SidebarMenuButton>
                 </Link>
              )}
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
