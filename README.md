# SpeakWell

SpeakWell is a local English conversation practice app. Speak into your microphone, receive a short AI reply and written grammar suggestions, then review past sessions. The app uses a Node.js server, a React frontend, a local JSON file for session history, and an OpenAI API key for transcription and conversation.

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

## Data and configuration

Sessions are stored in `backend/data/sessions.json`, created on first use and excluded from Git. Back up that file to preserve your history. `OPENAI_MODEL` in `backend/.env` selects the chat model; the default is `gpt-6-luna`. `PORT` can change the server port, but the Windows launcher opens port 8000.

The app currently displays text replies. Spoken replies and scored session analysis are not enabled in the current interface.

## Troubleshooting

- If the page says the API key is missing, check `backend/.env` and restart the server.
- If the browser cannot reach the app, check the launcher terminal for errors and confirm port 8000 is free.
- If recording fails, allow microphone permission for `localhost` in your browser.
- If an AI request fails, check your API key, network access, and OpenAI account limits. The server shows the returned error in its terminal.
