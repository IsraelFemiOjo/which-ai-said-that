# Which AI Said That?

A daily guessing game by Israel Femi-Ojo. Think you can tell which AI wrote each answer?

## What's in the folder

| File | What it does |
|---|---|
| `index.html`, `style.css`, `game.js` | The game itself |
| `editor.html` | Your page for making each day's round. No coding needed |
| `rounds/` | One file per day, named by date, like `2026-09-28.json` |
| `rounds/demo.json` | A demo round with placeholder text. Open the game with `?demo=1` to see it |
| `assets/` | Your IFO logo and favicon |
| `PROMPTS.md` | Starter prompts for your first week |

## Put it online (once)

1. On GitHub, create a new public repository called `which-ai-said-that`.
2. Click **Add file → Upload files** and drag in everything from this folder, keeping the `rounds` and `assets` folders.
3. Go to **Settings → Pages**. Under Source pick **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
4. After a minute the game is live at `https://israelfemiojo.github.io/which-ai-said-that/`.
5. Open `game.js` on GitHub, click the pencil, and set `launchDate` to the date of your first round. That date becomes round #1.

## Add a round (every day, or a week at a time)

1. Open `https://israelfemiojo.github.io/which-ai-said-that/editor.html` on your phone or laptop.
2. For each question: paste the prompt, pick the AI, type the exact model or access tier shown in the app, and paste the answer exactly as it came.
3. Tap **Preview round** to play it yourself first.
4. Tap **Download file**. You get a file named after the date. It only holds the four AI names, never the exact model.
5. Tap **Save private record** and keep that file somewhere safe. It holds the exact model or tier for each answer. Never upload it, because anything in the GitHub repo can be read by anyone.
6. On GitHub, open the `rounds` folder, click **Add file → Upload files**, and drop the file in. Commit.

The game picks up the file automatically on that date. If a day has no file, players see the most recent round instead of an empty page.

Your draft saves in the editor while you work, so you can close the tab and come back.

## Rules that keep the game honest

- New chat for every prompt. Turn off memory and custom instructions.
- Use the app's copy button. Never edit an answer, not even a typo.
- Record the exact model or access tier in your private record. Players only ever see ChatGPT, Claude, Gemini or Grok, and the site never claims any platform used its latest model.
- Use AI names only. No company logos.
- Future round files can be opened by anyone who guesses the web address, so don't upload too far ahead if you're worried about spoilers. A week is fine.

## Good to know

- Scores, streaks and averages save in each player's own browser. There are no accounts and no database.
- The share card is drawn in the browser. On phones, **Share image** opens the share sheet with the card attached. On desktop it downloads the image.
- Things like "only 23% of players got this right" need a small backend. Add that once people are playing.

## See how many people play (optional, free)

GitHub Pages doesn't show visitor numbers. To count plays:

1. Sign up at goatcounter.com and pick a code, for example `whichaisaidthat`.
2. Open `game.js` on GitHub, click the pencil, and put that code in `goatcounter: ""` so it reads `goatcounter: "whichaisaidthat"`. Commit.
3. Your GoatCounter dashboard now shows visits, where people came from (X, WhatsApp, Reddit), their countries and devices, plus these game events: `round-started`, `round-finished`, `score-4-of-5` and so on, `shared-x`, `shared-image`, `saved-image`, `copied-result`.

It counts people without cookies and without collecting names, so you'll see how many played, not who. To find out who, search X for "Which AI Said That?" and see who posted their score.
