/**
 * Hive API timestamps (bridge notifications, account history, custom_json
 * payloads) are UTC but usually lack a timezone designator
 * ("2026-07-09T14:30:00"). Bare `new Date()` parses those as LOCAL time,
 * shifting every comparison by the user's UTC offset.
 */
export function parseHiveDate(dateString: string): Date {
  // Keep strings that already carry an explicit timezone (Z or ±HH:MM);
  // otherwise mark the value as UTC before parsing.
  return /Z$|[+-]\d{2}:\d{2}$/i.test(dateString)
    ? new Date(dateString)
    : new Date(dateString + "Z");
}
