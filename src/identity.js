export const FORMS = ["Signal", "Orbit", "Astra", "Gravity"];
export const DEMO_NAMES = [
  "Lucas",
  "Mei Lin",
  "Arjun",
  "Sofia",
  "Jun Wei",
  "Amara",
  "Kai",
  "Priya",
  "Hana",
  "Nikhil",
  "Isabel",
  "Darius",
  "Nur",
  "Ethan",
  "Yuna",
  "Ravi",
  "Alicia",
  "Zhen",
];
const LINES = [
  "The room just got a little brighter.",
  "A new main character has entered.",
  "Your context window is now this room.",
  "Excellent timing. We saved you a star.",
  "Proof of human. Presence confirmed.",
  "Big ideas travel better in person.",
  "Zero-shot entrance. Nicely done.",
  "The next good idea might be yours.",
  "You had us at hello world.",
  "Some connections need no Wi-Fi.",
  "One small scan. A very good entrance.",
  "The universe has excellent taste in guests.",
];
export function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function identity(guest) {
  const seed = hash(guest.id);
  return {
    seed,
    line: LINES[seed % LINES.length],
    hue: 28 + (seed % 28),
    x: 8 + (seed % 840) / 10,
    y: 10 + ((seed >>> 10) % 780) / 10,
  };
}
export function cleanName(value) {
  return (
    String(value || "")
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim()
      .slice(0, 70) || "A new friend"
  );
}
