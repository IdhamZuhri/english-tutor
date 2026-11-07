/**
 * Picks the single "recommended next step" shown at the top of Home.
 *
 * Rules, in order:
 *  1. No activity at all      → a first conversation.
 *  2. Weekly goal not reached → alternate with the last speaking activity
 *                               (after a conversation suggest a surprise topic, otherwise a conversation).
 *  3. Goal reached            → a journal reflection, unless one was written today;
 *                               then an optional free conversation.
 */
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const time = value => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

export function recommendNext({ sessions = [], speeches = [], journalEntries = [], progress, now = new Date() }) {
  const spoken = sessions.filter(item => item.has_spoken);
  if (!spoken.length && !speeches.length && !journalEntries.length) {
    return { id: 'first-conversation', target: 'conversation', title: 'Have your first conversation', detail: 'Pick a topic and talk with Alex for a few minutes. There are no wrong answers.', action: 'Start a conversation' };
  }

  if (progress && !progress.complete) {
    const lastConversation = Math.max(0, ...spoken.map(item => time(item.last_spoke_at || item.created_at)));
    const lastSpeech = Math.max(0, ...speeches.map(item => time(item.created_at)));
    const remaining = `${progress.remaining} more ${progress.remaining === 1 ? 'practice reaches' : 'practices reach'} your weekly goal.`;
    if (lastConversation > lastSpeech) {
      return { id: 'surprise-topic', target: 'public-speaking', mode: 'impromptu', title: 'Speak on a surprise topic for 2 minutes', detail: `Switch things up after your last conversation. ${remaining}`, action: 'Spin a topic' };
    }
    return { id: 'conversation', target: 'conversation', title: 'Have a 5-minute conversation', detail: remaining, action: 'Start speaking' };
  }

  const journaledToday = journalEntries.some(entry => sameDay(new Date(entry.created_at), now));
  if (!journaledToday) {
    return { id: 'journal', target: 'journal', title: 'Reflect on your week in the journal', detail: 'You reached your speaking goal. Write or speak a short reflection about what felt easier.', action: 'Open the journal' };
  }
  return { id: 'bonus-conversation', target: 'conversation', title: 'Keep going with a free conversation', detail: 'Goal reached and journal done. Any extra practice is a bonus.', action: 'Start a conversation' };
}
