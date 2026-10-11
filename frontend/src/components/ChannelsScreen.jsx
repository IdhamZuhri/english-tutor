import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import './ChannelsScreen.css';

const categories = ['All', 'TV & series', 'Lessons', 'Real conversations', 'Pronunciation', 'News'];

const channels = [
  {
    name: 'Learn English With TV Series', category: 'TV & series', level: 'Intermediate',
    description: 'Breaks down dialogue from TV and films so you can learn natural expressions in context.',
    task: 'Pause after a line, repeat it aloud, then use one new phrase in your own sentence.',
    url: 'https://www.youtube.com/@LearnEnglishWithTVSeries',
  },
  {
    name: 'The Office', category: 'TV & series', level: 'Intermediate · Advanced',
    description: 'Short workplace comedy clips for listening to informal office conversations.',
    task: 'Watch a short clip twice. Describe the misunderstanding or joke in your own words.',
    url: 'https://www.youtube.com/@theoffice',
  },
  {
    name: 'BBC Learning English', category: 'Lessons', level: 'Beginner · Intermediate',
    description: 'Short, structured lessons on everyday vocabulary, grammar and listening.',
    task: 'Choose one useful expression and say three sentences using it.',
    url: 'https://www.youtube.com/@bbclearningenglish',
  },
  {
    name: 'English with Lucy', category: 'Lessons', level: 'Intermediate',
    description: 'Clear British English lessons on vocabulary, grammar and everyday usage.',
    task: 'After a lesson, explain the main rule or phrase aloud without looking at your notes.',
    url: 'https://www.youtube.com/@EnglishwithLucy',
  },
  {
    name: 'Easy English', category: 'Real conversations', level: 'Beginner · Intermediate',
    description: 'Subtitled street interviews featuring the way people speak in real life.',
    task: 'Answer the interviewer’s question yourself before listening to the next person.',
    url: 'https://www.youtube.com/@EasyEnglishVideos',
  },
  {
    name: "Rachel's English", category: 'Pronunciation', level: 'Intermediate',
    description: 'American English pronunciation and listening lessons built around real speech.',
    task: 'Repeat a short phrase, paying attention to stress, linking and reduced sounds.',
    url: 'https://www.youtube.com/@rachels_english',
  },
  {
    name: 'VOA Learning English', category: 'News', level: 'Beginner · Intermediate',
    description: 'News and learning videos in clear American English, often at a slower pace.',
    task: 'Summarize one story aloud in thirty seconds and add your opinion.',
    url: 'https://www.youtube.com/voalearningenglish',
  },
];

export default function ChannelsScreen() {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const visibleChannels = useMemo(() => channels.filter(channel =>
    (category === 'All' || channel.category === category) &&
    `${channel.name} ${channel.description} ${channel.category}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [category, query]);

  return <div className="channels-screen animate-in">
    <header className="channels-header">
      <span className="channels-eyebrow"><Icon name="play" size={16} /> WATCH & PRACTICE</span>
      <h1>Channels for better English</h1>
      <p>Find something worth watching, then turn it into speaking practice. These are hand-picked channels and official clips.</p>
    </header>

    <div className="channels-toolbar">
      <div className="channels-filters" role="group" aria-label="Filter channels by category">
        {categories.map(item => <button key={item} type="button" className={`channels-filter ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
      </div>
      <label className="channels-search">
        <Icon name="search" size={18} />
        <span className="sr-only">Search channels</span>
        <input type="search" placeholder="Search channels" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
    </div>

    <p className="channels-count" aria-live="polite">{visibleChannels.length} {visibleChannels.length === 1 ? 'channel' : 'channels'}</p>
    {visibleChannels.length ? <div className="channels-grid">
      {visibleChannels.map(channel => <article className="channel-card glass-card" key={channel.name}>
        <div className="channel-card-top"><span className="channel-mark"><Icon name="play" size={22} /></span><span className="channel-category">{channel.category}</span></div>
        <h2>{channel.name}</h2>
        <span className="channel-level">{channel.level}</span>
        <p className="channel-description">{channel.description}</p>
        <div className="channel-task"><strong>Try this</strong><span>{channel.task}</span></div>
        <a className="channel-link" href={channel.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${channel.name} on YouTube`}>Open on YouTube <span aria-hidden="true">↗</span></a>
      </article>)}
    </div> : <div className="channels-empty glass-card"><h2>No channels found</h2><p>Try a different search or category.</p><button className="btn btn-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button></div>}
    <p className="channels-note">Links open on YouTube. Channel libraries and video availability can change.</p>
  </div>;
}
