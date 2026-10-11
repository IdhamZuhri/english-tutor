const paths = {
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></>,
  plane: <><path d="M21 3 3 10l7 2 2 7 9-16ZM10 12l5-5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a21 21 0 0 0 18 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 2-2c0-1-.7-1.5-.7-2.2a2 2 0 0 1 2-2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" /><circle cx="7.5" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="9" cy="7.5" r=".7" fill="currentColor" stroke="none" /><circle cx="14" cy="7" r=".7" fill="currentColor" stroke="none" /><circle cx="17" cy="10.5" r=".7" fill="currentColor" stroke="none" /></>,
  dining: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v19M4 7h6M19 22V3c-4 2-5 7-5 11h5" /></>,
  laptop: <><rect x="4" y="4" width="16" height="13" rx="2" /><path d="M2 20h20l-2-3H4z" /></>,
  chat: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L3 21l1.9-5A8 8 0 1 1 20 11.5Z" />,
  chart: <><path d="M3 21h18M6 17v-6m6 6V5m6 12V9" /></>,
  edit: <><path d="M12 20h9M4 16l-.5 4.5L8 20l11-11-4-4L4 16ZM13 7l4 4" /></>,
  arrowLeft: <path d="m15 18-6-6 6-6M9 12h12" />,
  check: <path d="m4 12 5 5L20 6" />,
  award: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1.5 9 5-3 5 3-1.5-9" /></>,
  alert: <><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v5m0 3h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
};

export default function Icon({ name, size = 20, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
