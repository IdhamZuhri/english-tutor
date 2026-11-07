import { useEffect, useRef, useState } from 'react';
import SetupScreen from './components/SetupScreen.jsx';
import ChatScreen from './components/ChatScreen.jsx';
import SummaryScreen from './components/SummaryScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ChannelsScreen from './components/ChannelsScreen.jsx';
import LessonsScreen from './components/LessonsScreen.jsx';
import PublicSpeakingScreen from './components/PublicSpeakingScreen.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import JournalScreen from './components/JournalScreen.jsx';
import IdeaBoardScreen from './components/IdeaBoardScreen.jsx';
import SectionTabs from './components/SectionTabs.jsx';
import { validPersona } from './personas.js';
import { SECTIONS, sectionForScreen } from './navigation.js';

/**
 * App — top-level screen router.
 * Conversation flow: 'conversation' → 'session' → 'summary'.
 */
export default function App() {
  const [screen, setScreen] = useState('home');
  const [sessionSource, setSessionSource] = useState('conversation');
  const [selectedSpeechId, setSelectedSpeechId] = useState(null);
  const [selectedSpeechMode, setSelectedSpeechMode] = useState('prepared');
  const [selectedJournalId, setSelectedJournalId] = useState(null);
  const [speechFromHistory, setSpeechFromHistory] = useState(false);
  const [journalFromHistory, setJournalFromHistory] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [persona, setPersona] = useState(() => {
    try { return validPersona(localStorage.getItem('speakwell-persona')); }
    catch { return 'balanced'; }
  });

  const handlePersonaChange = value => {
    const next = validPersona(value);
    setPersona(next);
    try { localStorage.setItem('speakwell-persona', next); } catch { /* Storage may be unavailable. */ }
  };

  // Session config — set on the conversation page
  const [sessionConfig, setSessionConfig] = useState({
    topic: '',
    durationSecs: 300,
    focus: null,
    persona: 'balanced',
  });

  // Conversation history — accumulated during session, used for analysis
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const handleStart = ({ topic, durationSecs }) => {
    setSessionSource('conversation');
    setSessionConfig({ topic, durationSecs, focus: null, persona });
    setHistory([]);
    setSessionId(null);
    setIsHistoryView(false);
    setScreen('session');
  };

  const handleFocusedStart = ({ topic, focus }) => {
    setSessionSource('practice');
    setSessionConfig({ topic, durationSecs: 300, focus, persona });
    setHistory([]);
    setSessionId(null);
    setIsHistoryView(false);
    setScreen('session');
  };

  const handleSessionEnd = (conversationHistory, sid) => {
    setHistory(conversationHistory);
    setSessionId(sid);
    setIsHistoryView(false);
    setScreen('summary');
  };

  const handleViewHistory = (sid) => {
    setSessionId(sid);
    setIsHistoryView(true);
    setScreen('summary');
  };

  const handleRestart = () => {
    setHistory([]);
    setScreen(isHistoryView ? 'history' : sessionConfig.focus ? 'practice' : 'conversation');
  };

  // The Idea Board is a developer page, kept out of the learner navigation: open it at #ideas.
  useEffect(() => {
    const syncHash = () => { if (window.location.hash === '#ideas') setScreen('ideas'); };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  // Remember the last tab inside each section, so "Speak" returns to where you were.
  const lastScreenRef = useRef({});
  useEffect(() => {
    const section = sectionForScreen(screen);
    if (section) lastScreenRef.current[section.id] = screen;
  }, [screen]);

  const handleTabChange = (tabId, speechMode = 'prepared') => {
    if (tabId === 'public-speaking') { setSelectedSpeechId(null); setSelectedSpeechMode(speechMode); setSpeechFromHistory(false); }
    if (tabId === 'journal') { setSelectedJournalId(null); setJournalFromHistory(false); }
    if (window.location.hash === '#ideas') window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setScreen(tabId);
    window.scrollTo({ top: 0 });
  };

  const handleSectionNav = sectionId => {
    const section = SECTIONS.find(item => item.id === sectionId);
    if (!section) return;
    handleTabChange(lastScreenRef.current[sectionId] || section.screens[0].id);
  };

  const activeSection = screen === 'session' || (screen === 'summary' && !isHistoryView)
    ? (sessionSource === 'practice' ? 'progress' : 'speak')
    : screen === 'summary' ? 'progress'
    : sectionForScreen(screen)?.id || null;
  const tabSection = sectionForScreen(screen);

  const handleViewSpeech = (id, fromHistory = false) => {
    setSelectedSpeechId(id);
    setSpeechFromHistory(fromHistory);
    setScreen('public-speaking');
  };

  const handleViewJournal = (id, fromHistory = false) => {
    setSelectedJournalId(id);
    setJournalFromHistory(fromHistory);
    setScreen('journal');
  };

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={handleSectionNav} sessionActive={screen === 'session'} />

      <main className={`main-content ${screen === 'session' ? 'main-content--session' : ''}`}>
        <SectionTabs section={tabSection} activeScreen={screen} onSelect={handleTabChange} />
        {screen === 'home' && <HomeScreen onNavigate={handleTabChange} onViewHistory={handleViewHistory} onViewSpeech={handleViewSpeech} onViewJournal={handleViewJournal} />}

        {screen === 'conversation' && (
          <SetupScreen onStart={handleStart} persona={persona} onPersonaChange={handlePersonaChange} />
        )}

        {screen === 'history' && (
          <HistoryScreen onViewHistory={handleViewHistory} onViewSpeech={id => handleViewSpeech(id, true)} onViewJournal={id => handleViewJournal(id, true)} onNavigate={handleTabChange} />
        )}

        {screen === 'practice' && (
          <PracticeScreen onStartSpeaking={handleFocusedStart} onNavigate={handleTabChange} onViewSpeech={handleViewSpeech} />
        )}

        {screen === 'channels' && <ChannelsScreen />}

        {screen === 'lessons' && <LessonsScreen />}

        {screen === 'ideas' && <IdeaBoardScreen />}

        {screen === 'public-speaking' && <PublicSpeakingScreen key={`${selectedSpeechId || 'new'}-${selectedSpeechMode}`} initialMode={selectedSpeechMode} initialSpeechId={selectedSpeechId} onBackToHistory={speechFromHistory ? () => setScreen('history') : null} />}
        {screen === 'journal' && <JournalScreen initialEntryId={selectedJournalId} onBackToHistory={journalFromHistory ? () => setScreen('history') : null} />}

      {screen === 'session' && (
        <ChatScreen
          topic={sessionConfig.topic}
          durationSecs={sessionConfig.durationSecs}
          focus={sessionConfig.focus}
          persona={sessionConfig.persona}
          onSessionEnd={handleSessionEnd}
          onExit={handleRestart}
        />
      )}

        {screen === 'summary' && (
          <SummaryScreen
            history={history}
            sessionId={sessionId}
            isHistoryView={isHistoryView}
            topic={sessionConfig.topic}
            durationSecs={sessionConfig.durationSecs}
            focus={sessionConfig.focus}
            onRestart={handleRestart}
            onHome={() => handleTabChange('home')}
          />
        )}
      </main>
    </div>
  );
}
