# SpeakWell

SpeakWell is a local English speaking practice app. Home helps you choose between AI conversation, public speaking rehearsal, a daily journal, personalized practice, videos, notes, and history. The app uses a Node.js server, a React frontend, a local JSON file for session history, and an OpenAI API key for transcription and feedback.

## Requirements

- Node.js 20 or newer and npm
- An OpenAI API key with API access
- A browser with microphone support

Python and PostgreSQL are not required for the current app.

## Run on Windows

1. In `backend/.env`, set `OPENAI_API_KEY=...`. You can copy `backend/.env.example` if the file does not exist. Keep this file private.
2. Double-click `start.bat`, or run `./start.bat` from PowerShell in this folder.
3. Open <http://localhost:8000> and allow microphone access.

The launcher installs frontend packages if needed, builds the frontend, and starts one local server. Leave its terminal window open while using the app. Press Ctrl+C to stop it.

## Run with commands

```powershell
npm.cmd --prefix frontend install
npm.cmd run build
npm.cmd start
```

For frontend development, run `npm.cmd run dev` in another terminal, then open <http://localhost:5173>. Its `/api` requests proxy to the Node server on port 8000.

## Using a phone

The layout switches to a compact navigation menu on narrow screens. Recording must be started with a tap; the app will request microphone permission when you first record. Use a current browser and an HTTPS address when opening SpeakWell on a phone. A plain `http://` address to a computer on your local network is usually not a secure context, so mobile browsers will block microphone access. `http://localhost` works only on the same device running the server. Keep the server available while using conversation, public speaking, or spoken journaling; written journaling also needs the server to save entries.

## Data and configuration

Sessions are stored in `backend/data/sessions.json`, created on first use and excluded from Git. Back up that file and `backend/data/journal-audio/` to preserve your history and journal recordings. `OPENAI_MODEL` in `backend/.env` selects the chat model; the default is `gpt-6-luna`. `PORT` can change the server port, but the Windows launcher opens port 8000.

The app currently displays text replies. Spoken replies and scored session analysis are not enabled in the current interface.

## Public speaking

Open **Public Speaking** from the sidebar to rehearse a presentation, story, or persuasive pitch. Choose a challenge or enter your own topic, add up to three cue cards, and set a time goal. After recording, you can listen back and request a transcript-based review with strengths and one specific next step. Past reviews appear on the same page. SpeakWell saves the transcript and feedback in `backend/data/sessions.json`; the audio recording is only kept temporarily in the browser and is not saved. Feedback based on text cannot assess voice, pronunciation, eye contact, or body language.

For spontaneous speaking practice, choose **Surprise topic** and spin for an AI-generated prompt. Select 1, 2, 3, or 5 minutes and speak freely; the recording ends when time runs out. The review focuses on how clearly you develop your idea with reasons and examples. You can spin again before starting or finish early.

## Daily journal

Open **Daily Journal** to make a guided reflection, answer a few gentle follow-up questions, or journal freely. Write or record each response, and mix both in one entry. Choose a mood, review or edit your text, and save. Entries are organized by date; spoken responses include replayable audio. **Check grammar** is optional and runs only when selected. Journal text is saved in `backend/data/sessions.json` and recordings in `backend/data/journal-audio/`. Audio is sent to OpenAI only for transcription; journal text is sent for follow-up questions and optional grammar review.

## History

**History** combines conversations, public speaking rehearsals, and journal entries in one timeline. Filter by activity, search titles, and open an item to review it. Conversation transcripts can be exported as Markdown from the Conversations filter.

## Troubleshooting

- If the page says the API key is missing, check `backend/.env` and restart the server.
- If the browser cannot reach the app, check the launcher terminal for errors and confirm port 8000 is free.
- If recording fails, allow microphone permission for `localhost` in your browser.
- If an AI request fails, check your API key, network access, and OpenAI account limits. The server shows the returned error in its terminal.
