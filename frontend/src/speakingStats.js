/** Small, pure helpers for live conversation feedback. */

export function wordCount(text = '') {
  return (String(text).trim().match(/[\p{L}\p{N}'’-]+/gu) || []).length;
}

/**
 * Words and estimated pace for one spoken turn.
 * Pace is only reported for turns of 3+ seconds, where it means something.
 */
export function turnStats(text, speakingSecs) {
  const words = wordCount(text);
  const wpm = speakingSecs >= 3 && words > 0 ? Math.round(words / (speakingSecs / 60)) : null;
  return { words, wpm };
}

/** Share of the conversation's words spoken by the learner vs. the partner, in whole percent. */
export function talkShare(messages = []) {
  let you = 0;
  let partner = 0;
  for (const message of messages) {
    const words = wordCount(message.content);
    if (message.role === 'user') you += words;
    else partner += words;
  }
  const total = you + partner;
  if (!total) return { you: 0, partner: 0, total: 0 };
  const youPct = Math.round((you / total) * 100);
  return { you: youPct, partner: 100 - youPct, total };
}

export const formatClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
