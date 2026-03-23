interface Props {
  label: string;
  value: string | number;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'teal';
  sub?: string;
}

export default function StatCard({ label, value, color, sub }: Props) {
  return (
    <div className={`stat-card ${color}`}>
      <p className="label">{label}</p>
      <p className="value">{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}
