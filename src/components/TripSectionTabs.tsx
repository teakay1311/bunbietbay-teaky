import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export function TripSectionTabs({ tabs, fallback, children }: {
  tabs: Array<{ value: string; label: string }>;
  fallback: string;
  children: (activeTab: string) => ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.value === requestedTab) ? requestedTab! : fallback;

  return (
    <div>
      <nav aria-label="Mục trong khu vực" className="mb-6 inline-flex rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-current={activeTab === tab.value ? 'page' : undefined}
            onClick={() => {
              const nextSearchParams = new URLSearchParams(searchParams);
              nextSearchParams.set('tab', tab.value);
              setSearchParams(nextSearchParams, { replace: true });
            }}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${activeTab === tab.value ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-low'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {children(activeTab)}
    </div>
  );
}
