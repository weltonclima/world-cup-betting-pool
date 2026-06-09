/** Paginação client pura (PRD-05 — 20/página). Determinística, sem I/O. */
export interface Page<T> {
  items: T[];
  page: number; // página efetiva (clampada a [1, totalPages])
  totalPages: number;
}

export function paginate<T>(items: T[], page: number, size = 20): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const clamped = Math.min(Math.max(1, page), totalPages);
  const start = (clamped - 1) * size;
  return { items: items.slice(start, start + size), page: clamped, totalPages };
}
