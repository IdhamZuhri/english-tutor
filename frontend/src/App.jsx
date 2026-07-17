import { useState } from 'react';
import SetupScreen from './components/SetupScreen.jsx';
import ChatScreen from './components/ChatScreen.jsx';
import SummaryScreen from './components/SummaryScreen.jsx';

/**
 * App — top-level screen router.
 * Screens: 'setup' → 'session' → 'summary' → 'setup'
 */
export default function App() {
  const [screen, setScreen] = useState('setup');
  const [isHistoryView, setIsHistoryView] = useState(false);

  // Session config — set on setup screen
  const [sessionConfig, setSessionConfig] = useState({
    topic: '',
    durationSecs: 300,
  });

  // Conversation history — accumulated during session, used for analysis
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const handleStart = ({ topic, durationSecs }) => {
    setSessionConfig({ topic, durationSecs });
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
    setScreen('setup');
  };

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} onViewHistory={handleViewHistory} />
      )}

      {screen === 'session' && (
        <ChatScreen
          topic={sessionConfig.topic}
          durationSecs={sessionConfig.durationSecs}
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
          onRestart={handleRestart}
        />
      )}
    </>
  );
}
