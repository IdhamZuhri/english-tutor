# SpeakWell

**Build confidence speaking English through conversation practice, public speaking rehearsal, daily journaling, and personalized feedback.**

SpeakWell runs on your own computer and stores your history in your own Firestore project. OpenAI is used only for transcription and feedback.

---

## Features

| | |
|---|---|
| 💬 **AI conversation** | Hold spoken conversations with an AI partner and get feedback on your replies. |
| 🎤 **Public speaking** | Rehearse a presentation, story, or pitch with cue cards and a time goal, then get a transcript-based review. |
| 🎲 **Surprise topic** | Spin for a random prompt and speak for 1–5 minutes without preparation. |
| 📓 **Daily journal** | Write or speak guided reflections, answer gentle follow-up questions, and check your grammar if you want to. |
| 🎯 **Weekly quest** | Set a weekly practice goal. There are no streaks and no penalties. |
| 🕘 **History** | Review every conversation, rehearsal, and journal entry in one searchable timeline. |

---

## Quick start (Windows)

**You need:** Node.js 20+, an [OpenAI API key](https://platform.openai.com/api-keys), and a browser with microphone support.

1. Copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY=...`. Keep this file private.
2. Double-click `start.bat`, or run `./start.bat` from PowerShell.
3. Open **<http://localhost:8000>** and allow microphone access.

The launcher installs packages, builds the frontend, and starts the server. Keep its window open while you use the app, and press **Ctrl+C** to stop it.

### Run with commands

```powershell
npm.cmd --prefix frontend install
npm.cmd run build
npm.cmd start
```

**Frontend development:** run `npm.cmd run dev` in a second terminal and open <http://localhost:5173>. Requests to `/api` are proxied to port 8000.

**Tests:** `npm.cmd test`

---

## How it works

### Public speaking
Choose a challenge or enter your own topic, add up to three cue cards, and set a time goal. After recording, you can listen back and request a review with strengths and one specific next step. Past reviews appear on the same page.

> Feedback is based on your transcript, so it can't assess voice, pronunciation, eye contact, or body language. Audio stays in your browser and is not saved.

### Surprise topic
Spin for an AI-generated prompt, pick 1, 2, 3, or 5 minutes, and speak freely. Recording stops when time runs out. The review looks at how clearly you develop your idea with reasons and examples.

### Daily journal
Choose a guided reflection, gentle follow-up questions, or free journaling. You can write or record each response and mix both in one entry, then pick a mood, edit your text, and save. Entries are grouped by date, and spoken responses can be replayed. **Check grammar** runs only when you select it.

### Weekly quest
Choose 1, 2, 3, or 5 practices per week. A conversation counts once you send a spoken reply. A rehearsal counts once you save its review. The week runs Monday to Sunday in your local time.

### History
Filter by activity, search titles, and open any item to review it. You can export conversation transcripts as Markdown.

---

## Using a phone

On narrow screens the layout switches to a compact menu. Mobile browsers allow the microphone only over **HTTPS**. A plain `http://` address to another computer on your network is usually blocked, and `http://localhost` works only on the device that runs the server.

---

## Data & privacy

Text data is stored in Firestore. Journal recordings stay on this machine in `backend/data/journal-audio/` (excluded from Git; **back it up** to keep your recordings).

| What | Firestore collection |
|---|---|
| Conversations | `sessions` |
| Speech rehearsals | `speeches` |
| Practice answers | `practiceAttempts` |
| Journal entries | `journalEntries` |
| Next record id | `meta/app` |

#### Firestore setup (required)

1. In the Firebase console, open the project → **Build → Firestore Database** and create a database if you have not yet.
2. **Project settings → Service accounts → Generate new private key**, and save the file as `backend/firebase-service-account.json` (it is ignored by Git; never share it).
3. In `backend/.env` set `FIRESTORE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` (see `backend/.env.example`), then start the app.

The server will not start without these settings. `GET /api/health` reports `"storage": "firestore"` when connected.

Audio is sent to OpenAI only for transcription. Text is sent only for feedback, journal follow-up questions, and optional grammar checks.

### Configuration (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `OPENAI_API_KEY` | Required API key | — |
| `OPENAI_MODEL` | Chat model | `gpt-6-luna` |
| `PORT` | Server port (the Windows launcher always opens 8000) | `8000` |
| `FIRESTORE_PROJECT_ID` | Required Firestore project that stores all app data | — |
| `GOOGLE_APPLICATION_CREDENTIALS` | Required path to the service account key, relative to `backend/` | — |
| `FIRESTORE_DATABASE_ID` | Named Firestore database, if not `(default)` | `(default)` |

> SpeakWell shows replies as text. Spoken replies and scored session analysis are not enabled yet.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "API key is missing" | Check `backend/.env`, then restart the server. |
| Page won't load | Check the launcher window for errors and make sure port 8000 is free. |
| Recording fails | Allow microphone permission for `localhost` in your browser. |
| AI request fails | Check your API key, network connection, and OpenAI usage limits. The server window shows the error. |
