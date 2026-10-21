import * as StoreReview from 'expo-store-review';
import type { SQLiteDatabase } from 'expo-sqlite';
import { countDreams, getSetting, setSetting } from '@/lib/db';

const MIN_DREAMS = 3;
const MIN_DAYS_BETWEEN = 120;

// Asks for an App Store rating after a reading lands, once the user has a few
// dreams saved. Apple shows the prompt at most 3 times a year on its own.
export async function maybeAskForReview(db: SQLiteDatabase): Promise<void> {
  try {
    if ((await countDreams(db)) < MIN_DREAMS) return;
    const last = await getSetting(db, 'review_requested_at');
    if (last && Date.now() - Number(last) < MIN_DAYS_BETWEEN * 86_400_000) return;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    await setSetting(db, 'review_requested_at', String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    // A missed rating prompt is never worth surfacing to the user.
  }
}
