---
name: commit
description: Commit the current work in this repo with a proper Conventional Commit message. Use when the user types "commit", "/commit", "commit this", or "commit this work".
---

# Commit current work

Commit what has changed in the working tree with a clear, accurate message that matches this repo's history. Do not push, merge, or open a PR unless the user asks.

## 1. Inspect

Run these together:

```bash
git status --short
git diff --stat
git diff
git log --format='%s' -10
git branch --show-current
```

Also read untracked files you are about to commit (skim new files so the message describes them correctly).

If there is nothing to commit, say so and stop.

## 2. Decide what to stage

- Stage files **by path** (`git add path/one path/two`). Never `git add -A` or `git add .`.
- Never stage secrets or generated/local output: `.env*` (except `.env.example`), `backend/data/`, `node_modules/`, `dist/`, `build/`, `graphify-out/`, scratch or temp files.
- If the changes clearly cover unrelated pieces of work, ask whether to split them into separate commits, and suggest how.
- If a file looks accidental (debug logs, stray screenshots, large binaries), ask before including it.

## 3. Verify

Run `npm test` and, if any frontend file changed, `npm run build`.

- If either fails, do **not** commit. Show the failure and ask whether to fix it first or commit anyway.

## 4. Branch

- If on `main`, create a feature branch first, named `<type>/<short-kebab-summary>` (e.g. `feat/speech-review-tabs`), and tell the user.
- If already on a feature branch, commit there.

## 5. Write the message

Follow Conventional Commits, the style used in this repo:

```
<type>: <imperative summary, lowercase, no period, ≤ 72 chars>

<optional short intro line>
- <what changed and why, one bullet per meaningful change>
- <group bullets under plain headings (e.g. "Surprise topic", "Results") when the commit spans areas>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- **type**: `feat` (new user-facing behaviour), `fix` (bug fix), `refactor`, `style` (visual/CSS only), `docs`, `test`, `chore` (tooling, config, deps).
- The summary says what the commit does for the app, not which files changed.
- The body explains the change and, for fixes, the cause (e.g. "Whisper auto-detected Malay; lock transcription to English").
- Mention anything not verified or intentionally left out.
- Keep it factual: describe only what is in the diff.

Pass the message with a heredoc so formatting is preserved:

```bash
git commit -F - <<'MSG'
feat: ...

- ...

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

Never use `--no-verify` or `--amend` unless the user asks. If a hook fails, fix the cause and create a new commit.

## 6. Report

Run `git log --oneline -3` and `git status --short`, then tell the user in two or three lines:
- the commit hash, branch, and summary line
- anything left uncommitted and why
- that nothing was pushed (and the merge command if the work is on a feature branch)
