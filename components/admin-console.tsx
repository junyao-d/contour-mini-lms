"use client";

import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminConsultationsView } from "@/components/consultations/admin-consultations-view";
import { AdminUsersView } from "@/components/users/admin-users-view";

export function AdminConsole() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only overview of every consultation and account in the system.
        </p>
      </div>

      <Tabs defaultValue="consultations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="consultations">All Consultations</TabsTrigger>
          <TabsTrigger value="users">All Users</TabsTrigger>
        </TabsList>
        <TabsContent value="consultations">
          <AdminConsultationsView />
        </TabsContent>
        <TabsContent value="users">
          <AdminUsersView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
