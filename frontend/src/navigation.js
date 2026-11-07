/**
 * Five top-level sections (UI/UX Pro Max: nav-hierarchy, bottom-nav-limit ≤ 5).
 * Each section owns one or more screens; sections with several show tabs.
 * The Idea Board is intentionally not listed: it is a developer page reachable at #ideas.
 */
export const SECTIONS = [
  { id: 'today', label: 'Today', subtitle: 'Your next step', icon: 'home', screens: [{ id: 'home', label: 'Today' }] },
  { id: 'speak', label: 'Speak', subtitle: 'Conversation · Stage', icon: 'mic', screens: [{ id: 'conversation', label: 'Conversation', icon: 'chat' }, { id: 'public-speaking', label: 'Public speaking', icon: 'podium' }] },
  { id: 'journal', label: 'Journal', subtitle: 'Write or speak', icon: 'journal', screens: [{ id: 'journal', label: 'Journal' }] },
  { id: 'progress', label: 'Progress', subtitle: 'Practice · History', icon: 'chart', screens: [{ id: 'practice', label: 'My practice', icon: 'target' }, { id: 'history', label: 'History', icon: 'history' }] },
  { id: 'library', label: 'Library', subtitle: 'Notes · Channels', icon: 'book', screens: [{ id: 'lessons', label: 'English notes', icon: 'book' }, { id: 'channels', label: 'Channels', icon: 'play' }] },
];

export const sectionForScreen = screenId => SECTIONS.find(section => section.screens.some(screen => screen.id === screenId)) || null;
