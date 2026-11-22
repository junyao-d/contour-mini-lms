import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { SESSION_DURATION_OPTIONS } from "@/lib/domain/consultation-constants";
import { getCurrentSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";

async function AuthRedirectCheck() {
  const session = await getCurrentSession();

  if (session) {
    redirect(session.profile.role === "admin" ? "/admin" : "/dashboard");
  }

  return null;
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <AuthRedirectCheck />
      </Suspense>

      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <GraduationCap className="h-5 w-5 text-primary" />
            <span>Contour Mini-LMS</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-2xl space-y-5 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Manage Student Consultations Simply
          </h1>
          <p className="text-base text-muted-foreground">
            Book upcoming consultations, reschedule or cancel as plans change,
            track completed sessions, and give administrators a unified view
            across the system.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CalendarClock className="mb-2 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Easy Booking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Pick a time and a session length ({SESSION_DURATION_OPTIONS[0]}
              to {SESSION_DURATION_OPTIONS[SESSION_DURATION_OPTIONS.length - 1]}{" "}
              minutes). Your sessions never overlap.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CalendarCheck className="mb-2 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Full Control</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Reschedule upcoming sessions, cancel with confirmation, and mark
              consultations complete or incomplete anytime.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Admin Oversight</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Role-based access control gives administrators a searchable,
              filterable read-only view of every student consultation.
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Contour Mini-LMS &mdash; Built with Next.js &amp; Supabase
      </footer>
    </div>
  );
}
