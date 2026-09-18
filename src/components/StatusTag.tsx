import type { ReactNode } from "react";

export type StatusTagVariant = "ok" | "caution" | "risk" | "neutral";

const VARIANT_STYLES: Record<StatusTagVariant, { background: string; color: string }> = {
  ok: { background: "var(--color-ok-soft)", color: "var(--color-ok)" },
  caution: { background: "var(--color-caution-soft)", color: "var(--color-caution)" },
  risk: { background: "var(--color-risk-soft)", color: "var(--color-risk)" },
  neutral: { background: "var(--color-paper)", color: "var(--color-muted)" },
};

export function StatusTag({
  variant,
  children,
}: {
  variant: StatusTagVariant;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        ...VARIANT_STYLES[variant],
      }}
    >
      {children}
    </span>
  );
}
