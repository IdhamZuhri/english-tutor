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

  // Session config — set on setup screen
  const [sessionConfig, setSessionConfig] = useState({
    topic: '',
    durationSecs: 300,
  });

  // Conversation history — accumulated during session, used for analysis
  const [history, setHistory] = useState([]);

  const handleStart = ({ topic, durationSecs }) => {
    setSessionConfig({ topic, durationSecs });
    setHistory([]);
    setScreen('session');
  };

  const handleSessionEnd = (conversationHistory) => {
    setHistory(conversationHistory);
    setScreen('summary');
  };

  const handleRestart = () => {
    setHistory([]);
    setScreen('setup');
  };

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} />
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
          topic={sessionConfig.topic}
          durationSecs={sessionConfig.durationSecs}
          onRestart={handleRestart}
        />
      )}
    </>
  );
}
