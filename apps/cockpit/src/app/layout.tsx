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
        <div className="flex h-screen overflow-hidden bg-[#0d1117]">
          <Suspense fallback={<aside className="hidden h-full w-[270px] shrink-0 border-r border-border bg-[#0d1117] lg:block" />}>
            <Sidebar />
          </Suspense>

          <div className="flex flex-1 flex-col overflow-hidden">
            <Suspense fallback={<div className="h-[72px] w-full border-b border-border bg-[#0d1117]" />}>
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
