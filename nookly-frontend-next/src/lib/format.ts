export function formatNaira(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "";
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
