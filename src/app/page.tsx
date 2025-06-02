import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, FileText, BookText, Waypoints, Hash, DollarSign, Clock, Users, Route } from "lucide-react";
import Image from "next/image";

const FeatureCard = ({ title, description, icon: Icon, value, subValue }: { title: string; description: string; icon: React.ElementType; value?: string; subValue?: string;}) => (
  <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-lg font-headline font-medium text-primary">{title}</CardTitle>
      <Icon className="h-6 w-6 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-2">{description}</p>
      {value && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="bg-card p-8 rounded-lg shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h1 className="font-headline text-4xl font-bold text-primary mb-4">Welcome to GorkhaTrans</h1>
            <p className="text-lg text-foreground mb-6">
              Your all-in-one Transportation Management System. Streamline operations, optimize routes, and manage your logistics with ease.
            </p>
            <div className="flex gap-4">
                <Image src="https://placehold.co/600x400.png" alt="Logistics illustration" width={600} height={400} className="rounded-lg shadow-md object-cover" data-ai-hint="logistics truck" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard title="Total Shipments" description="Current month" icon={Route} value="1,234" subValue="+15% from last month" />
        <FeatureCard title="Revenue" description="Current month" icon={DollarSign} value="$45,231.89" subValue="+8.2% from last month"/>
        <FeatureCard title="Avg. Delivery Time" description="This week" icon={Clock} value="2.5 days" subValue="-0.2 days from last week"/>
        <FeatureCard title="Active Branches" description="Across all regions" icon={Building2} value="12" />
        <FeatureCard title="Managed Locations" description="Countries, states, cities" icon={MapPin} value="150+" />
        <FeatureCard title="Optimized Routes Today" description="Using Smart Route AI" icon={Waypoints} value="78" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {[
              { title: "Branch Management", icon: Building2, href:"/branch-management" },
              { title: "Locations & Units", icon: MapPin, href:"/locations" },
              // { title: "Route Optimization", icon: Waypoints, href:"/route-optimization" }, // Removed Route Optimization
              { title: "Narration Setup", icon: BookText, href:"/narration-setup" },
            ].map(item => (
              <Link href={item.href} key={item.title} className="block p-4 bg-secondary hover:bg-accent rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{item.title}</span>
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
              <span className="text-foreground">AI Route Optimizer</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-destructive text-destructive-foreground">Offline</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Database Connectivity</span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Real-time Data Feed</span>
               <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">Active</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Need to import Link from next/link
import Link from 'next/link';
