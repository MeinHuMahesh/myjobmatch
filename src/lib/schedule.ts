function parseField(field: string, min: number, max: number): number[] {
  if (!field || field === "*") {
    const all: number[] = [];
    for (let value = min; value <= max; value += 1) all.push(value);
    return all;
  }
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2)) || 1;
    const values: number[] = [];
    for (let value = min; value <= max; value += step) values.push(value);
    return values;
  }
  return field
    .split(",")
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max);
}

export function nextCronDate(expression: string, from: Date = new Date()): Date | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const minutes = parseField(parts[0], 0, 59).sort((a, b) => a - b);
  const hours = parseField(parts[1], 0, 23).sort((a, b) => a - b);
  if (minutes.length === 0 || hours.length === 0) return null;

  for (let dayOffset = 0; dayOffset <= 3; dayOffset += 1) {
    const base = new Date(from);
    base.setDate(base.getDate() + dayOffset);
    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate(),
          hour,
          minute,
          0,
          0,
        );
        if (candidate.getTime() > from.getTime()) return candidate;
      }
    }
  }
  return null;
}
