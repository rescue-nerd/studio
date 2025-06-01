"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
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
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/branch-management', label: 'Branch Management', icon: Building2 },
  { href: '/locations', label: 'Locations & Units', icon: MapPin },
  { href: '/content-customization', label: 'Content Customization', icon: FileText },
  { href: '/narration-setup', label: 'Narration Setup', icon: BookText },
  { href: '/route-optimization', label: 'Route Optimization', icon: Waypoints },
  { href: '/automatic-numbering', label: 'Automatic Numbering', icon: Hash },
];

export default function AppSidebarContent() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Truck className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
          <span className="font-headline text-2xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">GorkhaTrans</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {navItems.map((item) => (
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
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <SidebarMenu>
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
            <SidebarMenuItem>
                <SidebarMenuButton 
                    asChild
                    tooltip={{ children: "Logout", side: 'right', className: 'bg-popover text-popover-foreground' }}
                    className="justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                    <button onClick={() => alert("Logout clicked")}>
                        <LogOut className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                    </button>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
