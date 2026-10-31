import type { Metadata, Viewport } from "next";
import "./styles.css";
import { AppShell } from "../components/smart/app-shell";

export const metadata: Metadata = { title: "TechZephyr | CIT Scheduling", description: "Campus scheduling without conflicts", manifest: "/manifest.json" };
export const viewport: Viewport = { themeColor: "#0b172a" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body suppressHydrationWarning><AppShell>{children}</AppShell></body></html>; }
