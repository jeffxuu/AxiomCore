import React from 'react';

interface InsightCardProps {
  title?: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  badge,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-[var(--card)] border border-[var(--border)] px-6 py-[18px] transition-all duration-180 ease-in-out select-none ${className}`}
      style={{ contentVisibility: 'auto' }}
    >
      {(title || badge) && (
        <div className="flex items-center justify-between mb-3 border-b border-[var(--border)] pb-2">
          {title && (
            <span className="text-xs font-medium tracking-tight text-[var(--text)] opacity-90">
              {title}
            </span>
          )}
          {badge && (
            <span className="text-[10px] uppercase tracking-wider font-semibold opacity-65 font-mono">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="text-[12.5px] font-normal leading-relaxed text-[var(--text)]">
        {children}
      </div>
    </div>
  );
};
