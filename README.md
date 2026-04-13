# SpotifyShuffle

Reorders your Spotify playlist to create a truly shuffled playlist that plays each song exactly once.

```
https://spotifyshuffle-production.up.railway.app
```
*Or run on local host with `npx ts-node src/index.ts` 

<img width="1919" height="1002" alt="Screenshot 2026-03-18 190339" src="https://github.com/user-attachments/assets/45649ec9-588f-4d69-b4bf-58f9f6b8ebb7" />

## Tech Stack

- **Node.js / Express** - backend server
- **TypeScript** - typed throughout
- **Spotify Web API** - OAuth login, playlist read/write
- **Axios** - web requests
- **Railway** — deployment


## Notes

- Currently, Spotify accounts must be pre-authorized to access the app
- The shuffle rewrites the playlist in place — the original order is not preserved
- Spotify's API limits requests to 100 tracks per call, so large playlists may take a few seconds
- Rate limiting is handled automatically with retry logic
