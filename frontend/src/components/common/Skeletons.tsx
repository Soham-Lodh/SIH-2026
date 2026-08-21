import React from 'react';

export const IndiaMapSkeleton: React.FC = () => (
  <div className="w-full h-[420px] rounded-2xl bg-white border border-slate-200 animate-pulse skeleton-shimmer relative overflow-hidden flex flex-col justify-between p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="h-6 w-48 bg-slate-100 rounded-lg"></div>
      <div className="h-6 w-28 bg-slate-100 rounded-full"></div>
    </div>
    <div className="space-y-3 max-w-sm">
      <div className="h-4 w-3/4 bg-slate-100 rounded"></div>
      <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
    </div>
    <div className="flex gap-2">
      <div className="h-8 w-20 bg-slate-100 rounded-lg"></div>
      <div className="h-8 w-20 bg-slate-100 rounded-lg"></div>
    </div>
  </div>
);

export const UserMapSkeleton: React.FC = () => (
  <div className="w-full h-[320px] rounded-2xl bg-white border border-slate-200 animate-pulse skeleton-shimmer p-5 flex flex-col justify-between shadow-sm">
    <div className="flex justify-between items-center">
      <div className="h-5 w-40 bg-slate-100 rounded-lg"></div>
      <div className="h-5 w-24 bg-slate-100 rounded-full"></div>
    </div>
    <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto self-center"></div>
    <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
  </div>
);

export const LocationSkeleton: React.FC = () => (
  <div className="w-full h-[320px] rounded-2xl bg-white border border-slate-200 animate-pulse skeleton-shimmer p-6 space-y-4 shadow-sm">
    <div className="h-5 w-48 bg-slate-100 rounded-lg"></div>
    <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
    <div className="space-y-2">
      <div className="h-4 w-full bg-slate-100 rounded"></div>
      <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
      <div className="h-4 w-3/4 bg-slate-100 rounded"></div>
    </div>
    <div className="flex gap-3 pt-2">
      <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
      <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
    </div>
  </div>
);

export const AlertSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 animate-pulse skeleton-shimmer shadow-sm">
    <div className="flex justify-between">
      <div className="h-5 w-32 bg-slate-100 rounded-lg"></div>
      <div className="h-5 w-16 bg-slate-100 rounded-full"></div>
    </div>
    <div className="h-4 w-full bg-slate-100 rounded"></div>
    <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
  </div>
);

export const NewsSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse skeleton-shimmer">
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex justify-between">
          <div className="h-4 w-24 bg-slate-200 rounded"></div>
          <div className="h-4 w-16 bg-slate-200 rounded"></div>
        </div>
        <div className="h-4 w-full bg-slate-200 rounded"></div>
        <div className="h-3 w-4/5 bg-slate-100 rounded"></div>
      </div>
    ))}
  </div>
);

export const SearchSkeleton: React.FC = () => (
  <div className="w-full space-y-4 animate-pulse skeleton-shimmer">
    <div className="h-12 w-full bg-white rounded-2xl border border-slate-200 shadow-sm"></div>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-7 w-24 bg-slate-100 rounded-full"></div>
      ))}
    </div>
  </div>
);

export const EventCardSkeleton: React.FC = () => (
  <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 animate-pulse skeleton-shimmer shadow-sm">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <div className="h-6 w-64 bg-slate-100 rounded-lg"></div>
        <div className="h-4 w-40 bg-slate-100 rounded"></div>
      </div>
      <div className="h-6 w-20 bg-slate-100 rounded-full"></div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="h-14 bg-slate-50 rounded-xl p-2"></div>
      <div className="h-14 bg-slate-50 rounded-xl p-2"></div>
      <div className="h-14 bg-slate-50 rounded-xl p-2"></div>
    </div>
    <div className="h-4 w-full bg-slate-100 rounded"></div>
    <div className="flex justify-between items-center pt-2">
      <div className="h-4 w-28 bg-slate-100 rounded"></div>
      <div className="flex gap-2">
        <div className="h-8 w-24 bg-slate-100 rounded-xl"></div>
        <div className="h-8 w-24 bg-slate-100 rounded-xl"></div>
      </div>
    </div>
  </div>
);

export const TimelineSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 animate-pulse skeleton-shimmer">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-4 items-start">
        <div className="w-3 h-3 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 bg-slate-100 rounded"></div>
          <div className="h-4 w-full bg-slate-100 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

export const ChatSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse skeleton-shimmer">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-indigo-100 shrink-0"></div>
      <div className="space-y-2 flex-1 max-w-sm">
        <div className="h-4 bg-slate-100 rounded w-full"></div>
        <div className="h-4 bg-slate-100 rounded w-4/5"></div>
      </div>
    </div>
    <div className="flex items-start gap-3 justify-end">
      <div className="space-y-2 flex-1 max-w-sm">
        <div className="h-4 bg-indigo-50 rounded w-3/4 ml-auto"></div>
      </div>
      <div className="w-8 h-8 rounded-xl bg-slate-100 shrink-0"></div>
    </div>
  </div>
);
