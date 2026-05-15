export const fmt = {
  // Abbreviated: $1.4K, $2.3M — used for compact KPI cards across the app
  currency: (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000 ? `$${(v / 1_000).toFixed(1)}K` : `$${v.toFixed(2)}`,
  // Exact: $10,985.10 — used where precision matters (Google Ads, invoices, etc.)
  currencyExact: (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (v: number) => `${v.toFixed(1)}%`,
  num: (v: number) => v.toLocaleString(),
  change: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
}

export const cn = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(' ')
