const StatTile = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</dd>
    </div>
  );
};

export default StatTile;
