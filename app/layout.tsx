import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hack Line",
  description: "Personal life assistant — calendars, tasks, and the daily planner",
};

function Nav() {
  const links = [
    { href: "/", label: "Today" },
    { href: "/history", label: "History" },
    { href: "/settings", label: "Settings" },
  ];
  return (
    <header className="border-b border-border" style={{ backgroundImage: "var(--aurora)" }}>
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* Curling house mark */}
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <circle cx="11" cy="11" r="10" fill="none" stroke="var(--accent-2)" strokeWidth="1.5" />
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <circle cx="11" cy="11" r="3" fill="var(--gold)" />
          </svg>
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Hack Line
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-5 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before first paint; light is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
