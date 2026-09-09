import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function createStore(file, eventId) {
  let records = [];
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (saved.eventId !== eventId)
      throw new Error(
        "The saved guest history belongs to another event. Set a separate DATA_FILE for this event.",
      );
    if (!Array.isArray(saved.records))
      throw new Error(
        "Guest history is invalid. Restore the event data file from backup.",
      );
    records = saved.records;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const seen = new Set(records.map((g) => g.id));
  return {
    add(guest) {
      if (seen.has(guest.id)) return false;
      if (records.length >= 10000) throw new Error("Event capacity reached.");
      const item = { ...guest, sequence: records.length + 1 };
      const next = records.concat(item);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify({ eventId, records: next }), {
        mode: 0o600,
      });
      renameSync(`${file}.tmp`, file);
      records = next;
      seen.add(guest.id);
      return true;
    },
    read(after = 0, initial = false) {
      const arrivals = initial
        ? records.slice(-200)
        : records.filter((g) => g.sequence > after).slice(0, 200);
      return {
        arrivals,
        total: records.length,
        sequence: arrivals.at(-1)?.sequence ?? records.length,
      };
    },
  };
}
