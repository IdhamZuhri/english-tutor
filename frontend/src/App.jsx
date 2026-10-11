import { useState } from 'react';
import SetupScreen from './components/SetupScreen.jsx';
import ChatScreen from './components/ChatScreen.jsx';
import SummaryScreen from './components/SummaryScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import { validPersona } from './personas.js';

/**
 * App — top-level screen router.
 * Screens: 'setup' → 'session' → 'summary' → 'setup'
 */
export default function App() {
  const [screen, setScreen] = useState('setup');
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

  // Session config — set on setup screen
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
    setSessionConfig({ topic, durationSecs, focus: null, persona });
    setHistory([]);
    setSessionId(null);
    setIsHistoryView(false);
    setScreen('session');
  };

  const handleFocusedStart = ({ topic, focus }) => {
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
    setScreen(!isHistoryView && sessionConfig.focus ? 'practice' : 'setup');
  };

  const handleTabChange = (tabId) => {
    setScreen(tabId);
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={screen} onTabChange={handleTabChange} />
      
      <main className="main-content">
        {screen === 'setup' && (
          <SetupScreen onStart={handleStart} persona={persona} onPersonaChange={handlePersonaChange} />
        )}

        {screen === 'history' && (
          <HistoryScreen onViewHistory={handleViewHistory} />
        )}

        {screen === 'practice' && (
          <PracticeScreen onStartSpeaking={handleFocusedStart} />
        )}

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
          />
        )}
      </main>
    </div>
  );
}
