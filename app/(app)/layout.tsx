import { Suspense } from "react";
import { AppNavbar } from "@/components/app-navbar";

function NavbarFallback() {
  return (
    <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
      <span className="font-semibold tracking-tight">Contour Mini-LMS</span>
    </div>
  );
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <Suspense fallback={<NavbarFallback />}>
          <AppNavbar />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Contour Mini-LMS &mdash; Student Consultation Portal
      </footer>
    </div>
  );
}
