import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

export async function AppNavbar() {
  const session = await getCurrentSession();
  const profile = session?.profile ?? null;
  const isAdmin = profile?.role === "admin";
  const homeHref = profile ? (isAdmin ? "/admin" : "/dashboard") : "/";

  return (
    <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex items-center gap-6">
        <Link
          href={homeHref}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <GraduationCap className="h-5 w-5 text-primary" />
          <span>Contour Mini-LMS</span>
        </Link>

        {profile && (
          <nav className="flex items-center gap-4 text-sm">
            {isAdmin ? (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Console</span>
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                My Consultations
              </Link>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.email}
            </span>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "Student"}
            </Badge>
            <LogoutButton />
          </>
        )}
        <ThemeSwitcher />
      </div>
    </div>
  );
}
