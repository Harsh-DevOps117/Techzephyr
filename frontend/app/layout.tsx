import type { Metadata, Viewport } from "next";
import "./styles.css";
import "./studio.css";
import { AppShell } from "../components/smart/app-shell";

export const metadata: Metadata = {
  title: "TechZephyr | CIT Scheduling",
  description: "Campus scheduling without conflicts",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body suppressHydrationWarning><AppShell>{children}</AppShell></body></html>; }
