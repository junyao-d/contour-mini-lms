import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { StudentDashboard } from "@/components/consultations/student-dashboard";

async function DashboardContent() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (session.profile.role === "admin") {
    redirect("/admin");
  }

  return (
    <StudentDashboard
      profileFirstName={session.profile.first_name}
      profileLastName={session.profile.last_name}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
