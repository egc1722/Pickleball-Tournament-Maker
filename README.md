# Pickleball Tournament Maker

A simple page for running pickleball tournaments. No install needed.

## Open it
Double-click `index.html`. It opens in your browser.

Always open it from the same folder and in the same browser. Your classes and scores are saved in that browser, so a different browser or a moved folder will look empty.

Tip: bookmark the page (Ctrl+D) instead of making a desktop shortcut.

## Use it
1. **Class list tab:** add names, or import a .csv file (names in the first column; see `roster_template.csv`).
2. **Class picker (top bar):** switch between classes like 9am and 10am. Each class keeps its own list, days and scores.
3. **Play days tab:**
   - Click **Start day 1** (or **+ New day** for later days).
   - Tap names to mark who is here. Add latecomers with the box below.
   - Pick Doubles or Singles, then click **Make game**. Up to 3 games per day.
   - Choose the winner and type the winning points for each game.
   - Click **Edit players** to change who is in a game.
4. **Standings tab:** see wins and points. Use the download buttons to get spreadsheets (.csv).

## Rules the app follows
- 4 courts, so up to 16 players in doubles or 8 in singles per game.
- In doubles, nobody has the same partner twice. If partners run out, it repeats as few as possible and shows a note.
- Extra players sit out, and the people who have played the least get to play first.

## Files
- `index.html`, `app.js`, `style.css`: the app
- `roster_template.csv`: example class list