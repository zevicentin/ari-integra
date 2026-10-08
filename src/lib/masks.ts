export const initials = (value: string) => value.split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "AR";

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function phoneMask(value: string) {
  const d = digitsOnly(value);
  // So treat digits 12/13 as a country code when a "+" was actually typed, otherwise
  // "5543999990000" would be truncated as if 55 were the area code.
  const withCountry = /^\s*\+/.test(value) && d.length > 11;
  const countryCode = withCountry ? d.slice(0, 2) : "";
  const local = withCountry ? d.slice(2) : d;
  if (!local.length) return countryCode;
  const head = countryCode ? `+${countryCode} ` : "";
  if (local.length <= 2) return `${head}(${local}`;
  if (local.length <= 6) return `${head}(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10) return `${head}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `${head}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

export function documentMask(value: string) {
  const d = digitsOnly(value);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function dateMask(value: string) {
  const d = digitsOnly(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Postgres reports no error when an UPDATE matches zero rows, so a write blocked by RLS
// or by a column grant looks exactly like a success. Every save below confirms the row
// came back instead of trusting the absence of an error.
export function confirmed<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw result.error;
  if (result.data == null) throw new Error(`Não foi possível salvar ${what}: nenhuma linha foi alterada. Sua conta pode não ter permissão para esta alteração.`);
  return result.data;
}
