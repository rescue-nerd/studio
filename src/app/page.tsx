
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

const FeatureCard = ({ title, description, icon: Icon, value, subValue, isLoading }: { title: string; description: string; icon: React.ElementType; value?: string | number; subValue?: string; isLoading?: boolean;}) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-lg font-headline font-medium text-primary">{title}</CardTitle>
      <Icon className="h-6 w-6 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-2">{description}</p>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          {subValue && <Skeleton className="h-4 w-1/2" />}
        </div>
      ) : (
        <>
          {value !== undefined && (
            <div className="text-2xl font-bold text-foreground">
              {typeof value === 'number' && title.toLowerCase().includes('revenue') ? `Rs. ${value.toFixed(2)}` : value.toString()}
            </div>
          )}
          {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

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

  const [dashboardData, setDashboardData] = useState({
    totalShipmentsMonth: 0,
    revenueMonth: 0,
    activeBranches: 0,
    managedLocations: 0,
  });
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsDashboardLoading(true);
      try {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const biltisCollectionRef = collection(db, "biltis");
        const shipmentsQuery = query(biltisCollectionRef,
          where("miti", ">=", Timestamp.fromDate(firstDayOfMonth)),
          where("miti", "<=", Timestamp.fromDate(lastDayOfMonth))
        );
        const shipmentsSnapshotPromise = getCountFromServer(shipmentsQuery);

        const revenueQuery = query(biltisCollectionRef,
          where("miti", ">=", Timestamp.fromDate(firstDayOfMonth)),
          where("miti", "<=", Timestamp.fromDate(lastDayOfMonth))
        );
        const revenueSnapshotPromise = getDocs(revenueQuery);

        const branchesCollectionRef = collection(db, "branches");
        const activeBranchesQuery = query(branchesCollectionRef, where("status", "==", "Active"));
        const activeBranchesSnapshotPromise = getCountFromServer(activeBranchesQuery);

        const citiesCountSnapshotPromise = getCountFromServer(collection(db, "cities"));
        const statesCountSnapshotPromise = getCountFromServer(collection(db, "states"));
        const countriesCountSnapshotPromise = getCountFromServer(collection(db, "countries"));

        const [
          shipmentsSnapshot,
          revenueSnapshot,
          activeBranchesSnapshot,
          citiesCountSnapshot,
          statesCountSnapshot,
          countriesCountSnapshot,
        ] = await Promise.all([
          shipmentsSnapshotPromise,
          revenueSnapshotPromise,
          activeBranchesSnapshotPromise,
          citiesCountSnapshotPromise,
          statesCountSnapshotPromise,
          countriesCountSnapshotPromise,
        ]);
        
        const totalShipmentsMonth = shipmentsSnapshot.data().count;
        const revenueMonth = revenueSnapshot.docs.reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);
        const activeBranches = activeBranchesSnapshot.data().count;
        const managedLocations = citiesCountSnapshot.data().count + statesCountSnapshot.data().count + countriesCountSnapshot.data().count;

        setDashboardData({
          totalShipmentsMonth,
          revenueMonth,
          activeBranches,
          managedLocations,
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast({ title: "Error", description: "Could not load dashboard statistics.", variant: "destructive" });
      } finally {
        setIsDashboardLoading(false);
      }
    };

    fetchData();
  }, [user, toast]);

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
              src="https://placehold.co/1200x300.png" // Wider banner
              alt="Logistics background" 
              width={1200} 
              height={300} 
              className="object-cover w-full h-48 md:h-60" 
              data-ai-hint="modern abstract logistics"
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FeatureCard title="Total Shipments" description="Current month" icon={Package} value={dashboardData.totalShipmentsMonth} isLoading={isDashboardLoading} />
        <FeatureCard title="Revenue" description="Current month" icon={DollarSign} value={dashboardData.revenueMonth} isLoading={isDashboardLoading}/>
        <FeatureCard title="Active Branches" description="Across all regions" icon={Building2} value={dashboardData.activeBranches} isLoading={isDashboardLoading} />
        <FeatureCard title="Managed Locations" description="Cities, states, countries" icon={MapPin} value={dashboardData.managedLocations} isLoading={isDashboardLoading} />
      </div>
      
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

    
