// Structure guides for impromptu speaking. Each framework is an established, published technique
// (see `source`); the steps follow the original model. The sentence starters are "sentence frames",
// a standard scaffolding technique for language learners, written to fit each original step.
export const SPEECH_FRAMEWORKS = [
  {
    id: 'prep',
    name: 'PREP',
    bestFor: 'Opinions and quick answers',
    source: 'Point–Reason–Example–Point, a standard impromptu structure taught by Toastmasters International and in business communication training.',
    steps: [
      { label: 'Point', hint: 'Give your answer in one sentence.', starters: ['In my opinion, …', 'I strongly believe that …', 'My answer is simple: …'] },
      { label: 'Reason', hint: 'Explain why you think so.', starters: ['This is because …', 'The main reason is that …', 'I say this because …'] },
      { label: 'Example', hint: 'Share a story, fact or experience.', starters: ['For example, …', 'I remember when …', 'A good example of this is …'] },
      { label: 'Point', hint: 'Restate your answer to finish.', starters: ['That is why I believe …', 'So, to sum up, …', 'In the end, …'] },
    ],
  },
  {
    id: 'ppf',
    name: 'Past · Present · Future',
    bestFor: 'Topics about change or trends',
    source: 'Chronological "past, present, future" pattern, a classic Toastmasters Table Topics technique and a standard speech organisation pattern in public-speaking textbooks.',
    steps: [
      { label: 'Past', hint: 'How things were before.', starters: ['In the past, …', 'When I was younger, …', 'A few years ago, …'] },
      { label: 'Present', hint: 'How things are now.', starters: ['Nowadays, …', 'These days, …', 'Right now, …'] },
      { label: 'Future', hint: 'How things might change.', starters: ['In the future, I think …', 'I expect that …', 'Hopefully, one day …'] },
    ],
  },
  {
    id: 'wsn',
    name: 'What? So what? Now what?',
    bestFor: 'Reflecting on an idea or experience',
    source: 'Borton\'s reflective framework (1970), developed by Rolfe, Freshwater & Jasper (2001); widely used for reflection and impromptu speaking.',
    steps: [
      { label: 'What?', hint: 'Describe the idea or situation.', starters: ['Let me explain what this is about: …', 'The situation is that …', 'Basically, …'] },
      { label: 'So what?', hint: 'Say why it matters.', starters: ['This matters because …', 'What this shows is …', 'The reason this is important is …'] },
      { label: 'Now what?', hint: 'Say what should happen next.', starters: ['So, from now on, …', 'What we should do is …', 'Next time, I will …'] },
    ],
  },
  {
    id: 'star',
    name: 'STAR',
    bestFor: '"Describe a time when…" stories',
    source: 'Situation–Task–Action–Result, the behavioural interview method from Development Dimensions International (DDI).',
    steps: [
      { label: 'Situation', hint: 'Set the scene: when and where.', starters: ['A while ago, …', 'It happened when …', 'The situation was …'] },
      { label: 'Task', hint: 'What you needed to do.', starters: ['My goal was to …', 'I had to …', 'The challenge was …'] },
      { label: 'Action', hint: 'What you did, step by step.', starters: ['First, I …', 'Then I decided to …', 'After that, …'] },
      { label: 'Result', hint: 'What happened and what you learned.', starters: ['In the end, …', 'As a result, …', 'What I learned was …'] },
    ],
  },
  {
    id: 'monroe',
    name: 'Monroe\'s Motivated Sequence',
    bestFor: 'Persuading or proposing an idea',
    source: 'Alan H. Monroe, "Principles and Types of Speech" (1935); a standard persuasive structure in communication textbooks.',
    steps: [
      { label: 'Attention', hint: 'Hook the listener.', starters: ['Imagine …', 'Have you ever …?', 'Did you know that …?'] },
      { label: 'Need', hint: 'Show the problem.', starters: ['The problem is …', 'Many people struggle with …', 'Right now, …'] },
      { label: 'Satisfaction', hint: 'Offer your solution.', starters: ['The answer is …', 'What we can do is …', 'My idea is …'] },
      { label: 'Visualization', hint: 'Picture the result.', starters: ['Picture a world where …', 'If we do this, …', 'Imagine how much better …'] },
      { label: 'Action', hint: 'Ask for one clear step.', starters: ['So, I encourage you to …', 'Starting today, let\'s …', 'Please try …'] },
    ],
  },
];

export const GUIDE_LEVELS = [
  { id: 'light', label: 'Light', description: 'Step names and a short hint.' },
  { id: 'detailed', label: 'Detailed', description: 'Adds sentence starters for each step.' },
];

export const getFramework = id => SPEECH_FRAMEWORKS.find(framework => framework.id === id) || SPEECH_FRAMEWORKS[0];

// Light keyword match from the topic's wording to the framework designed for that kind of question.
export function suggestFramework(topic = '') {
  const text = topic.toLowerCase();
  if (/\b(describe a time|tell (us |me )?about a time|a time when|a moment when|have you ever)\b/.test(text)) return 'star';
  if (/\b(convince|persuade|propose|pitch|should (we|our|your|every|the government|schools|cities|companies))\b/.test(text)) return 'monroe';
  if (/\b(changed?|changing|future|years? ago|nowadays|in \d+ years|will .* (be|look|change)|over time|used to)\b/.test(text)) return 'ppf';
  if (/\b(learn(ed|t)?|lesson|experience|taught|reflect|matter)\b/.test(text)) return 'wsn';
  return 'prep';
}
