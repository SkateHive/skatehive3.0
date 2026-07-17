/**
 * Fill {placeholders} in a translated string.
 * Unknown placeholders are left as-is so missing vars are visible in dev.
 *
 * tVars(t('cofrinhos.savedToast'), { amount: '5.000', name: 'Trip' })
 */
export function tVars(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}
