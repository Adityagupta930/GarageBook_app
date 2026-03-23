interface Props {
  label: string;
  value: string | number;
  color: 'green' | 'blue' | 'orange' | 'red';
}

const colors = {
  green:  'bg-green-600',
  blue:   'bg-blue-600',
  orange: 'bg-orange-500',
  red:    'bg-red-600',
};

export default function StatCard({ label, value, color }: Props) {
  return (
    <div className={`${colors[color]} text-white rounded-xl p-5`}>
      <p className="text-sm opacity-90">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
