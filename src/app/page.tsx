
"use client"; 

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, FileText, BookText, Hash, DollarSign, Clock, Users, Package, PlusSquare, ClipboardPlus, ArchiveRestore, PackageOpen } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { useAuth } from "@/contexts/auth-context"; 
import { useRouter } from "next/navigation"; 
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getCountFromServer, Timestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// FeatureCard component is removed as it's no longer used.

const QuickActionCard = ({ title, icon: Icon, href, description }: { title: string; icon: React.ElementType; href: string; description?: string; }) => (
  <Link href={href} passHref>
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
        <Icon className="h-10 w-10 text-primary mb-3" />
        <p className="font-semibold text-md text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  </Link>
);


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Removed dashboardData and isDashboardLoading states

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Removed useEffect for fetchData as FeatureCards are removed

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">{authLoading ? "Loading..." : "Redirecting..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="relative">
            <Image 
              src="https://placehold.co/1200x300.png" 
              alt="Logistics background" 
              width={1200} 
              height={300} 
              className="object-cover w-full h-48 md:h-60" 
              data-ai-hint="logistics abstract"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 md:p-8">
              <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">
                Welcome, {user?.displayName || user?.email}!
              </h1>
              <p className="text-md sm:text-lg text-muted-foreground max-w-2xl">
                Manage your GorkhaTrans operations efficiently.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The div containing FeatureCards has been removed */}
      
      <div>
        <h2 className="text-2xl font-headline font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard title="Create New Bilti" icon={PlusSquare} href="/invoicing" description="Start a new shipment invoice." />
            <QuickActionCard title="Create New Manifest" icon={ClipboardPlus} href="/manifests" description="Group Biltis for a trip." />
            <QuickActionCard title="Record Goods Receipt" icon={ArchiveRestore} href="/goods-receipt" description="Log incoming goods." />
            <QuickActionCard title="Record Goods Delivery" icon={PackageOpen} href="/goods-delivery" description="Confirm delivered items." />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Configuration Access</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Branch Management", icon: Building2, href:"/branch-management" },
              { title: "Locations & Units", icon: MapPin, href:"/locations" },
              { title: "Narration Setup", icon: BookText, href:"/narration-setup" },
              { title: "Content Customization", icon: FileText, href: "/content-customization"},
              { title: "Auto Numbering", icon: Hash, href: "/automatic-numbering"},
              { title: "Settings", icon: Users, href: "/settings"}
            ].map(item => (
              <Link href={item.href} key={item.title} className="block p-3 bg-secondary hover:bg-accent/80 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground text-sm">{item.title}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Database Connectivity</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Real-time Data Feed</span>
               <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">User Authentication</span>
               <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">Online</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
