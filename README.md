# SpotifyShuffle

Reorders your Spotify playlist to create a truly shuffled playlist that plays each song exactly once.

```
https://spotifyshuffle-production.up.railway.app/home
```

## Tech Stack

- **Node.js / Express** — backend server
- **TypeScript** — typed throughout
- **Spotify Web API** — OAuth login, playlist read/write
- **Railway** — deployment


## Notes

- Currently, Spotify accounts must be pre-authorized to access the app
- The shuffle rewrites the playlist in place — the original order is not preserved
- Spotify's API limits requests to 100 tracks per call, so large playlists may take a few seconds
- Rate limiting is handled automatically with retry logic
