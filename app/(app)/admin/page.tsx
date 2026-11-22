import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminConsultationsView } from "@/components/consultations/admin-consultations-view";

async function AdminContent() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (session.profile.role !== "admin") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <CardTitle>403 &mdash; Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            You need an Administrator role to view system-wide consultations.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to My Consultations</Link>
          </Button>
        </CardContent>
      </Card>
    );
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
