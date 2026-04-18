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
        className="rounded-md border border-blue-300/35 shadow-[0_0_0_3px_rgba(88,166,255,0.18)]"
      />
      <div>
        <span className="block text-lg font-bold tracking-tight text-slate-100">GitFlow</span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-blue-300/65">Telemetry</span>
      </div>
    </div>
  );
}
