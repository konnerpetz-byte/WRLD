# WRLD: live award search

A small browser extension for the WRLD points explorer.

- **Live search:** in the explorer, click "Search live". The extension looks up Alaska Airlines
  (Atmos Rewards) award prices on alaskaair.com in your own browser, the same calendar alaskaair.com
  shows anyone without signing in, one request a second (at most 30 per search), and sends them back
  to the explorer. It never runs on its own and stops if alaskaair.com asks it to slow down.
- **Send to WRLD:** on any airline's award results, click the toolbar button to send the dates,
  points and taxes you see to WRLD, where you check them before sharing.

Permissions: `activeTab`, `scripting`, and access to www.alaskaair.com (for live search). It runs a
relay on wrldtrips.com/points only, to pass messages between the explorer and the extension.

The Alaska calendar parser is adapted from Award Buddy (MIT License, Copyright (c) 2026 Kuan-Yin Chen,
https://github.com/kevchentw/awardbuddy).

Install (Chrome, Edge, Brave): open `chrome://extensions`, turn on Developer mode, choose
"Load unpacked" and pick this folder.
