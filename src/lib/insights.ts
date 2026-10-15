import type { PatternItem } from './types';

/** Plain-English weekly insight built locally from pattern counts (no AI call, no cost). */
export function weeklyInsight(week: PatternItem[], dreamsThisWeek: number): string | null {
  if (dreamsThisWeek === 0) return null;
  const top = week.filter((p) => p.kind !== 'emotion' && p.count >= 2)[0];
  const emotion = week.filter((p) => p.kind === 'emotion')[0];
  const rising = week.find((p) => p.kind !== 'emotion' && p.count >= 2 && p.count > p.previousCount);

  const parts: string[] = [];
  parts.push(`You recorded ${dreamsThisWeek} dream${dreamsThisWeek === 1 ? '' : 's'} this week.`);
  if (top) parts.push(`"${cap(top.name)}" showed up in ${top.count} of them.`);
  if (rising && rising !== top) parts.push(`"${cap(rising.name)}" is appearing more than the week before.`);
  if (emotion) parts.push(`The most common feeling was ${emotion.name}.`);
  if (!top && !emotion) parts.push('Keep going: patterns start to show after a few entries.');
  return parts.join(' ');
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
