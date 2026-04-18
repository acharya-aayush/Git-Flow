import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export const metadata: Metadata = {
  title: 'GitFlow Control Room',
  description: 'High-signal pull request intelligence for engineering teams.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overscroll-none">
        <div className="relative flex h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -left-24 top-8 h-60 w-52 rotate-[8deg] rounded-2xl bg-blue-500/10 blur-3xl" />
            <div className="absolute right-10 top-2 h-64 w-56 -rotate-6 rounded-2xl bg-slate-400/10 blur-3xl" />
          </div>

          <Suspense fallback={<aside className="hidden h-full w-[270px] shrink-0 border-r border-border/80 bg-[#161b22]/95 lg:block" />}>
            <Sidebar />
          </Suspense>

          <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
            <Suspense fallback={<div className="h-[72px] w-full border-b border-border/70 bg-[#161b22]/85" />}>
              <Topbar />
            </Suspense>
            <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[1300px]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
