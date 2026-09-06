/**
 * Lexorank Implementation for Orders Route Sequence
 * 
 * Uses base-36 ('0'-'9', 'a'-'z') fractional indexing to allow arbitrary
 * insertions between any two orders without re-numbering all rows.
 * Includes automatic redundancy check and safe upper-limit rebalancing 
 * if rank length exceeds MAX_RANK_LENGTH (default 16 chars).
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length; // 36
const MID_CHAR = 'i'; // Alphabet midpoint (index 18)
export const MAX_RANK_LENGTH = 16;

function charToVal(c: string): number {
  const idx = ALPHABET.indexOf(c);
  return idx >= 0 ? idx : 0;
}

function valToChar(v: number): string {
  if (v < 0) return ALPHABET[0];
  if (v >= BASE) return ALPHABET[BASE - 1];
  return ALPHABET[v];
}

/**
 * Generates initial evenly spaced base ranks for a list of items.
 * Example for 3 items: ['00rs', '01jk', '02bg']
 */
export function generateInitialRanks(count: number): string[] {
  if (count <= 0) return [];
  const ranks: string[] = [];
  const baseStep = 1000;
  for (let i = 0; i < count; i++) {
    const val = (i + 1) * baseStep;
    ranks.push(val.toString(BASE).padStart(4, '0'));
  }
  return ranks;
}

/**
 * Calculates a new Lexorank string strictly between `prev` and `next` (prev < result < next).
 * Handles null/undefined for start-of-list or end-of-list insertions.
 */
export function getRankBetween(prev?: string | null, next?: string | null): string {
  const p = prev ? prev.trim() : '';
  const n = next ? next.trim() : '';

  // Case 1: Empty list (neither prev nor next exists)
  if (!p && !n) {
    return '0100';
  }

  // Case 2: Insert before `next` (at the very beginning)
  if (!p && n) {
    let prefix = '';
    for (let i = 0; i < n.length; i++) {
      const v = charToVal(n[i]);
      if (v > 0) {
        const mid = Math.floor(v / 2);
        return prefix + valToChar(mid);
      }
      prefix += '0';
    }
    return prefix + MID_CHAR;
  }

  // Case 3: Insert after `prev` (at the very end)
  if (p && !n) {
    let prefix = '';
    for (let i = 0; i < p.length; i++) {
      const v = charToVal(p[i]);
      if (v < BASE - 1) {
        const mid = Math.floor((v + BASE - 1) / 2);
        if (mid > v) {
          return prefix + valToChar(mid);
        }
      }
      prefix += p[i];
    }
    return prefix + MID_CHAR;
  }

  // Case 4: Insert between `prev` and `next`
  // Ensure p is strictly less than n. If inverted, swap to avoid invalid ordering
  if (p >= n) {
    return p + MID_CHAR;
  }

  let i = 0;
  while (i < p.length && i < n.length && p[i] === n[i]) {
    i++;
  }

  const commonPrefix = p.slice(0, i);
  const pVal = i < p.length ? charToVal(p[i]) : 0;
  const nVal = i < n.length ? charToVal(n[i]) : BASE - 1;

  if (nVal - pVal > 1) {
    const mid = Math.floor((pVal + nVal) / 2);
    return commonPrefix + valToChar(mid);
  }

  // Adjacent characters, e.g. 'a' and 'b'. Append midpoint to deeper level
  const remainingP = p.slice(i + 1);
  return commonPrefix + (p[i] || '0') + getRankBetween(remainingP, null);
}

/**
 * Checks if any order's rank has exceeded the maximum safe length or is invalid.
 */
export function shouldRebalance(ranks: (string | undefined | null)[]): boolean {
  if (!ranks || ranks.length === 0) return false;
  return ranks.some(r => !r || r.length >= MAX_RANK_LENGTH);
}

/**
 * Rebalances a list of items preserving their current order, 
 * resetting ranks to short, clean base strings.
 */
export function rebalanceRanks<T extends { route_rank?: string | null }>(items: T[]): T[] {
  const freshRanks = generateInitialRanks(items.length);
  return items.map((item, idx) => ({
    ...item,
    route_rank: freshRanks[idx]
  }));
}

/**
 * Stable sort of orders by route_rank ascending.
 * Orders without route_rank are placed at the end while preserving relative order.
 */
export function sortOrdersByRouteRank<T extends { route_rank?: string | null; id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankA = a.route_rank ? a.route_rank.trim() : '';
    const rankB = b.route_rank ? b.route_rank.trim() : '';

    if (rankA && rankB) {
      if (rankA < rankB) return -1;
      if (rankA > rankB) return 1;
      return 0;
    }
    if (rankA && !rankB) return -1;
    if (!rankA && rankB) return 1;
    return 0;
  });
}
