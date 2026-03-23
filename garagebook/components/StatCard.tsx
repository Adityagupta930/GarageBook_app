import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'teal';
  sub?: string;
  icon?: string;
  sparkline?: ReactNode;
}

export default function StatCard({ label, value, color, sub, icon, sparkline }: Props) {
  return (
    <div className={`stat-card ${color}`}>
      {icon && <span className="s-icon">{icon}</span>}
      <p className="label">{label}</p>
      <p className="value">{value}</p>
      {sub && <p className="sub">{sub}</p>}
      {sparkline && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', opacity: 0.35, pointerEvents: 'none' }}>
          {sparkline}
        </div>
      )}
    </div>
  );
}
