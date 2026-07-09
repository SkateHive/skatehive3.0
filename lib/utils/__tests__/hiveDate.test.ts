import assert from "assert";
import { parseHiveDate } from "../hiveDate";

// Zone-less Hive timestamp must be read as UTC regardless of the machine's
// timezone. The old parser treated it as local time because its timezone
// check matched the hyphens in the DATE part, which caused the notification
// badge to stay lit after mark-as-read for users west of UTC.
assert.strictEqual(
  parseHiveDate("2026-07-09T14:30:00").getTime(),
  Date.UTC(2026, 6, 9, 14, 30, 0),
  "zone-less timestamp should parse as UTC"
);

// Explicit designators must pass through untouched.
assert.strictEqual(
  parseHiveDate("2026-07-09T14:30:00.000Z").getTime(),
  Date.UTC(2026, 6, 9, 14, 30, 0),
  "Z-suffixed timestamp should not be double-suffixed"
);
assert.strictEqual(
  parseHiveDate("2026-07-09T11:30:00-03:00").getTime(),
  Date.UTC(2026, 6, 9, 14, 30, 0),
  "offset timestamp should be respected"
);

// The badge scenario: notification arrived before mark-as-read → not new.
const notificationDate = "2026-07-09T14:00:00"; // bridge format, UTC
const lastRead = "2026-07-09T15:00:00.000Z"; // stored by mark-as-read
assert.ok(
  parseHiveDate(notificationDate) < parseHiveDate(lastRead),
  "notification older than lastRead must not count as unread"
);

console.log("✅ hiveDate tests passed");
