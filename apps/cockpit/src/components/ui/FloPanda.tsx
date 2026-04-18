import React from 'react';
import Image from 'next/image';

export function FloPanda({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/gfp.png"
        alt="GitFlow Panda Logo"
        width={36}
        height={36}
        className="rounded-md border border-border"
      />
      <div>
        <span className="block text-lg font-bold tracking-tight text-slate-100">GitFlow</span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">Telemetry</span>
      </div>
    </div>
  );
}
