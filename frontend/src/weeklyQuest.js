export const weeklyGoals = [1, 2, 3, 5];
export const defaultWeeklyGoal = 3;

export function weeklySpeakingProgress(sessions, speeches, goal = defaultWeeklyGoal, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const inWeek = value => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  };
  const conversationCount = sessions.filter(item => item.has_spoken && inWeek(item.last_spoke_at || item.created_at)).length;
  const speechCount = speeches.filter(item => inWeek(item.created_at)).length;
  const count = conversationCount + speechCount;
  return { count, goal, remaining: Math.max(0, goal - count), complete: count >= goal };
}
