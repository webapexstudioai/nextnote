import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrbitGridLogo } from "@/components/OrbitGridLogo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(5,5,7,0.85)] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <OrbitGridLogo size={24} />
          </Link>
          <Link
            href="/"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to NextNote
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 legal-prose">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] py-8 mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center justify-between text-xs text-[var(--muted)]">
          <p>© {new Date().getFullYear()} NextNote by Apex Studio. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
            <a href="mailto:support@nextnote.to" className="hover:text-[var(--foreground)] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
