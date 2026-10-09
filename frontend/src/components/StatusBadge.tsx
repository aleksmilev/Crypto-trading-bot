interface StatusBadgeProps {
  label: string;
  ok: boolean;
  value?: string;
}

export function StatusBadge({ label, ok, value }: StatusBadgeProps) {
  return (
    <div className={`badge ${ok ? "badge-ok" : "badge-error"}`}>
      <span className="badge-label">{label}</span>
      <span className="badge-value">{value ?? (ok ? "ok" : "error")}</span>
    </div>
  );
}
