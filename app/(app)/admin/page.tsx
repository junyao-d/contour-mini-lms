import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AdminConsultationsView } from "@/components/consultations/admin-consultations-view";

async function AdminContent() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  // Non-admins are sent to their own dashboard; the admin API independently returns 403.
  if (session.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return <AdminConsultationsView />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted/40" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
