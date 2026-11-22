import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

// Minimal header for the auth pages: brand link back home and the theme switch.
// No Sign in / Sign up buttons, since each form already links to the other.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <GraduationCap className="h-5 w-5 text-primary" />
            <span>Contour Mini-LMS</span>
          </Link>
          <ThemeSwitcher />
        </div>
      </header>
      {children}
    </div>
  );
}
