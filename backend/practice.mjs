const categories = ['Grammar', 'Sentence structure', 'Vocabulary'];

function categoryFor(correction) {
  if (categories.includes(correction.category)) return correction.category;
  const note = `${correction.explanation || ''} ${correction.original || ''} ${correction.corrected || ''}`.toLowerCase();
  if (/word order|sentence|fragment|clause|run.on|syntax|structure/.test(note)) return 'Sentence structure';
  if (/vocab|word choice|natural|expression|phrase|collocation|preposition/.test(note)) return 'Vocabulary';
  return 'Grammar';
}

export function practiceInsights(sessions, attempts = []) {
  const turns = sessions.flatMap(session => (session.history || [])
    .filter(message => message.role === 'user' && message.content)
    .map(message => ({ ...message, sessionId: session.id, topic: session.topic, date: session.created_at })));
  const issues = turns.flatMap(turn => (turn.corrections?.corrections || [])
    .filter(item => item && typeof item.original === 'string' && typeof item.corrected === 'string' && item.original.trim() && item.corrected.trim() && item.original.trim().toLowerCase() !== item.corrected.trim().toLowerCase())
    .map(item => ({ original: item.original, corrected: item.corrected, explanation: item.explanation || '', category: categoryFor(item), sentence: turn.content, sessionId: turn.sessionId, topic: turn.topic, date: turn.date })));
  const areas = categories.map(category => {
    const matches = issues.filter(issue => issue.category === category);
    return { category, count: matches.length, examples: matches.slice(-3).reverse() };
  }).sort((a, b) => b.count - a.count);
  return {
    sessionCount: sessions.filter(session => (session.history || []).some(message => message.role === 'user')).length,
    turnCount: turns.length,
    issueCount: issues.length,
    confidence: turns.length >= 8 && sessions.length >= 2 ? 'developing' : 'early',
    areas,
    exercises: issues.slice(-12).reverse().map((issue, index) => ({ ...issue, id: `${issue.sessionId}-${index}`, correctOption: index % 2 })),
    attempts: attempts.slice(-100),
  };
}
