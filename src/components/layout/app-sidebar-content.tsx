
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import React from 'react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator, 
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  Building2, 
  MapPin, 
  FileText, 
  BookText, 
  Waypoints, 
  Hash,
  Truck,
  Settings,
  LogOut,
  LogIn, // Added LogIn icon
  Car, 
  Users2,
  Warehouse,
  Receipt,
  ClipboardList,
  ArchiveRestore,
  PackageOpen,
  BookMarked, 
  BarChartBig,
  BookOpenCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context'; // Import useAuth
import { auth } from '@/lib/firebase'; // Import auth for signOut
import { signOut } from 'firebase/auth'; // Import signOut
import { useToast } from '@/hooks/use-toast'; // Import useToast

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: "Could not log out. Please try again.", variant: "destructive" });
    }
  };
  
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
    if (typeof window !== 'undefined') { // Ensure this runs client-side
        router.push('/login');
    }
    return null; 
  }


  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
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
                      <Link href={item.href} passHref legacyBehavior>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                          tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
                          className={cn(
                            "justify-start",
                            pathname === item.href ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <a>
                            <item.icon className="h-5 w-5" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          </a>
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
                   <Link href="/settings" passHref legacyBehavior>
                      <SidebarMenuButton 
                          asChild
                          isActive={pathname === "/settings"}
                          tooltip={{ children: "Settings", side: 'right', className: 'bg-popover text-popover-foreground' }}
                          className={cn(
                              "justify-start",
                              pathname === "/settings" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                      >
                          <a>
                              <Settings className="h-5 w-5" />
                              <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                          </a>
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
                    <button onClick={handleLogout}>
                        <LogOut className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                    </button>
                </SidebarMenuButton>
              ) : (
                 <Link href="/login" passHref legacyBehavior>
                     <SidebarMenuButton 
                        asChild
                        isActive={pathname === "/login"}
                        tooltip={{ children: "Login", side: 'right', className: 'bg-popover text-popover-foreground' }}
                        className={cn(
                            "justify-start",
                            pathname === "/login" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                    >
                        <a>
                            <LogIn className="h-5 w-5" />
                            <span className="group-data-[collapsible=icon]:hidden">Login</span>
                        </a>
                    </SidebarMenuButton>
                 </Link>
              )}
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
