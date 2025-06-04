
import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import AppSidebarContent from '@/components/layout/app-sidebar-content';
import AppHeader from '@/components/layout/app-header';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context'; // Import AuthProvider
import { FirebaseEmulatorInitializer } from '@/components/shared/firebase-emulator-initializer';

export const metadata: Metadata = {
  title: 'GorkhaTrans - TMS',
  description: 'Efficient Transportation Management System by GorkhaTrans',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body 
        className={cn("font-body antialiased min-h-screen bg-background text-foreground")}
        suppressHydrationWarning={true}
      >
        <AuthProvider> {/* Wrap with AuthProvider */}
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full"> {/* Added w-full */}
              <Sidebar collapsible="icon" className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex">
                 <AppSidebarContent />
              </Sidebar>
              <SidebarInset className="flex flex-col"> {/* SidebarInset is now a div, removed redundant flex-1 */}
                <AppHeader />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                  {children}
                </main>
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
          <FirebaseEmulatorInitializer />
        </AuthProvider>
      </body>
    </html>
  );
}

