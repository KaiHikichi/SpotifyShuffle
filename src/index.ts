import express from 'express';
import axios, { all } from 'axios';
import querystring from 'querystring';
import * as fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const client_id = process.env.client_id ?? '';
const client_secret = process.env.client_secret ?? '';
//const playlist_id = process.env.playlist_id ?? '';
let playlist_id = '4d3BQUdCNhgBOKbNde214u';
const port = process.env.PORT ?? 8888;

const isProduction = process.env.NODE_ENV === 'production';
const redirect_uri = isProduction
    ? 'https://spotifyshuffle-production.up.railway.app/callback'
    : 'http://127.0.0.1:8888/callback';

let access_token = '';


//run the server
const app = express();

if (isProduction) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
} else {
    app.listen(Number(port), '127.0.0.1', () => {
        console.log(`Server running at http://127.0.0.1:${port}`);
    });
}

//interfaces////////////////////////////////////////////////////////////////////////////////
interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
}

interface SpotifyProfile {
    display_name: string;
    email: string;
    id: string;
}

interface SpotifyDeviceObject{
    id: string;
    is_active: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
}

interface SpotifyTrack{
    album: object;
    artists: object[];
    duration: number;
    external_irls: object;
    href: string;
    id: string;
    name: string;
    type: string;
    uri: string;
}

interface SpotifyTrackList {
    href: string;
    limit: number;
    next: string;
    offset: number;
    previous: string;
    total: number;
    items: SpotifyTrackObject[];
}

interface SpotifyTrackObject {
    added_at: string;
    track: SpotifyTrack;
}

interface SpotifyPlaylistTrackObject{
    added_at: string;
    added_by: object;
    is_local: boolean;
    item: SpotifyTrack;
}

interface SpotifyPlaylist {
    id: string;
    name: string;
}


//route handlers/////////////////////////////////////////////////

// get user permissions
app.get('/login', (req, res) => {

    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email user-library-read user-modify-playback-state user-read-playback-state playlist-modify-private playlist-modify-public playlist-read-private';

    res.redirect(
        'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state,
            show_dialog: true
        })
    );
});

//use user permissions to get access key
app.get('/callback', async function(req, res) {

    const code = req.query.code;

    if (!code) {
        return res.send('No authorization code received');
    }
    if (typeof code !== 'string') {
        return res.status(400).send('Invalid code');
    }

    try {
        const response = await axios.post<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri
        }),
        {
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization':
                'Basic ' +
                Buffer.from(client_id + ':' + client_secret).toString('base64')
            }
        }
        );

        access_token = response.data.access_token;
        const homeUrl = isProduction
            ? 'https://spotifyshuffle-production.up.railway.app/home'
            : 'http://127.0.0.1:8888/home';
        res.redirect(homeUrl);
    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /callback");
    }
});

//home page
app.get('/home', async (req, res) => {

    try {

        res.sendFile('home.html', { root: './src' });

    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /home");
    }
});

//shuffle page
app.get('/shuffle', async (req, res) => {

    const playlist_id = req.query.playlist_id;
    if (!playlist_id || typeof playlist_id !== 'string') {
        return res.status(400).send('Missing playlist_id');
    }

    try {

        let allPlaylistTracks: SpotifyTrack[] = await getAllPlaylistTracks(playlist_id);
        await withRetry(() => clearPlaylist(playlist_id));        
        let shuffledTracks = shuffleArray(allPlaylistTracks);
        await appendAllPlaylist(playlist_id, shuffledTracks);

        const homeUrl = isProduction
            ? 'https://spotifyshuffle-production.up.railway.app/home'
            : 'http://127.0.0.1:8888/home';
        res.redirect(`${homeUrl}?shuffled=1`);

    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /shuffle");
    }
});

//user page
app.get('/user', async (req, res) => {

    if (!access_token) {
        return res.json({ loggedIn: false });
    }
    try {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        res.json({ loggedIn: true, display_name: response.data.display_name });
    } catch (error: unknown) {
        res.json({ loggedIn: false });
    }

});

//clear page
app.get('/clear', async (req, res) => {

    const playlist_id = req.query.playlist_id;
    if (!playlist_id || typeof playlist_id !== 'string') {
        return res.status(400).send('Missing playlist_id');
    }

    try {
        res.send("under construction");
/* 
        await withRetry(() => clearPlaylist(playlist_id));
        
        const homeUrl = isProduction
            ? 'https://spotifyshuffle-production.up.railway.app/home'
            : 'http://127.0.0.1:8888/home';
        res.redirect(homeUrl);
         */

    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /clear");
    }
});

//update page
app.get('/update', async (req, res) => {

    try {
        res.send("under construction");

        /* 
        let allSavedTracks: SpotifyTrack[] = await getAllSavedTracks();
        await appendAllPlaylist(playlist_id, allSavedTracks);
        res.send(`Updated`);
 */
    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /update");
    }
});

//playlist page
app.get('/playlists', async (req, res) => {

    try {
        const playlists = await withRetry(() => getUserPlaylists());
        res.json(playlists);

    } 
    catch (error: unknown) {
        handleError(error);
        res.status(500).send("Server error in /playlists");
    }
});


















//helpers////////////////////////////////////////////

//gets all active instances of Spotify (must be open or playing music)
async function getDevices(): Promise<SpotifyDeviceObject[]> {
    let devices: SpotifyDeviceObject[] = [];

    const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    });

    devices = response.data.devices;
    return devices;
}

//get user profile
async function getProfile(): Promise<SpotifyProfile> {
    var profile: SpotifyProfile = {
        display_name: "",
        email: "",
        id: " "
    } 

    const response = await axios.get<SpotifyProfile>('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    });

    profile = response.data;

    return profile;
}

//get 50 liked songs ( returns songs either sorted by recently added )
//offset: integer denoting where to start reading from saved library
async function getSavedTracks(offset: number): Promise<SpotifyTrack[]> {
    var trackList: SpotifyTrackList = {
        href: "",
        limit: 1,
        next: "",
        offset: 1,
        previous: "",
        total: 1,
        items: []
    } 
    let tracks: SpotifyTrack[] = [];

    const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
        headers: {
            Authorization: `Bearer ${access_token}`
        },
        params: {
            limit: 50,
            offset: offset
        }
    });

    trackList = response.data;

    trackList.items.forEach(t => {
        tracks.push(t.track);
    });

    return tracks;
}

//put all songs in user's liked songs in an array
async function getAllSavedTracks(): Promise<SpotifyTrack[]> {
    let offset = 0;
    let allTracks: SpotifyTrack[] = [];
    let tempTracks = await withRetry(() => getSavedTracks(offset));

    //push each batch of 50
    while(tempTracks.length == 50){
        //push each track to allTracks array
        tempTracks.forEach(item => {
            allTracks.push(item);
        });
        offset = offset + 50;
        tempTracks = await withRetry(() => getSavedTracks(offset));
    }
    //push final batch
    tempTracks.forEach(item => {
        allTracks.push(item);
    });

    return allTracks;
}

//get 50 tracks from playlist
//offset: integer denoting where to start reading from saved library
//playlist_id: id of spotify playlist to read from
async function getPlaylistTracks(offset: number, playlist_id: string): Promise<SpotifyTrack[]> {
    let tracks: SpotifyTrack[] = [];


    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlist_id}/items`, {
        headers: {
            Authorization: `Bearer ${access_token}`
        },
        params: {
            limit: 50,
            offset: offset
        }
    });

    let trackList: SpotifyPlaylistTrackObject[] = response.data.items;
    
    trackList.forEach(t => {
        tracks.push(t.item);
    });

    return tracks;
}

//put all songs in user's liked songs in an array
//playlist_id: id of spotify playlist to read from
async function getAllPlaylistTracks(playlist_id: string): Promise<SpotifyTrack[]> {
    let offset = 0;
    let allTracks: SpotifyTrack[] = [];
    let tempTracks = await getPlaylistTracks(offset, playlist_id);

    while(tempTracks.length == 50){
        //push each track to allTracks array
        tempTracks.forEach(item => {
            allTracks.push(item);
        });
        offset = offset + 50;
        tempTracks = await getPlaylistTracks(offset, playlist_id);
    }
    tempTracks.forEach(item => {
        allTracks.push(item);
    });

    return allTracks;
}

//appends a max of 100 items to a playlist
//if an item already exists in playlist it will be added again
async function appendToPlaylist(playlist_id: string, tracks: SpotifyTrack[]) {

    if(tracks.length == 0){ 
        throw new Error('No tracks to append');
    }

    //get array of track uris
    let uris: string[] = []; 
    let counter = 0
    tracks.forEach(item => {
        if ( counter >= 100){
            return true;
        }
        uris.push(item.uri);
        counter++;
    });

    let body = {
        uris: uris,
    }

    const response = await axios.post(`https://api.spotify.com/v1/playlists/${playlist_id}/items`, body, {
        headers: {
            Authorization: `Bearer ${access_token}`
        },
        params: {
            playlist_id: playlist_id,
        }
    });
}

async function appendAllPlaylist(playlist_id: string, tracks: SpotifyTrack[]){
    if(tracks.length == 0){ 
        throw new Error('No tracks to append');
    }

    let offset: number = 0;
    let temp: SpotifyTrack[] = tracks.slice(0);

    //append batches in 100
    while(temp.length > 0){
        await withRetry(() => appendToPlaylist(playlist_id, temp));
        offset = offset + 100;
        temp = tracks.slice(offset);
    }
} 

/* 
uses too many api calls

async function shufflePlaylist(playlist_id: string, length: number){
    let body = {
        range_start: 0,
        insert_before: 0,
        range_length: 1
    }
    let interval_min: number = 0;
    body.range_start = getRandomInt(interval_min, length - 1);

    let counter: number = 0;
    while(interval_min < length){
        try {
            const response = await axios.put(`https://api.spotify.com/v1/playlists/${playlist_id}/items`, body, {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json"
                }
            });

        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status == 429) {
                const retryAfterHeader = error.response?.headers['retry-after'];
                const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                console.warn(`Rate limited. Wait for ${waitSeconds} seconds before retrying get saved tracks. At track: ${interval_min}`);
                await sleep(waitSeconds * 1000);
            }
            else{
                handleError(error, "Shuffle");
            }   
        }

        interval_min += 1;
        body.range_start = getRandomInt(interval_min, length - 1);
    }
} 
*/

async function clearPlaylist(playlist_id: string){
    let body = {
        uris: []
    }

    const response = await axios.put(`https://api.spotify.com/v1/playlists/${playlist_id}/items`, body, {
        headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json"
        }
    });

}

// get all of the current user's playlists
async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
    let playlists: SpotifyPlaylist[] = [];
    let offset = 0;

    while (true) {
        const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { limit: 50, offset: offset }
        });

        const items: SpotifyPlaylist[] = response.data.items.map((p: any) => ({
            id: p.id,
            name: p.name
        }));

        playlists.push(...items);

        if (response.data.next) {
            offset += 50;
        } else {
            break;
        }
    }

    return playlists;
}

//print tracks to fileName
function printTracks(tracks: SpotifyTrack[], fileName: string){

    let i = 1
    fs.writeFileSync(fileName, "Songs:\n");
    tracks.forEach(item => {
        fs.appendFileSync(fileName, `${i}: ${item.name}\n`);
        i++;
    });

}

//shuffle array
function shuffleArray<SpotifyTrack>(arr: SpotifyTrack[]): SpotifyTrack[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i]!, arr[j]!] = [arr[j]!, arr[i]!];
    }

    return arr;
}

function handleError(error: unknown){
    if (axios.isAxiosError(error)) {
        if (error.response) {
            console.error("API call failed:", error.response?.data || error.message);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error in request setup:', error.message);
        }
    } 
    else {
        console.error('An unknown error occurred:', error);
    } 
}

async function withRetry<T>(fn: () => Promise<T>, retries: number = 10) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } 
        catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const isRateLimit = error.status === 429 || error.message?.includes("Too Many Requests");

                if (isRateLimit && attempt < retries) {

                    const retryAfterHeader = error.response?.headers['retry-after'];
                    const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
                    console.warn(`Rate limited. Wait for ${waitSeconds} seconds before retrying get saved tracks.`);
                    await sleep(waitSeconds * 1000);

                } else {
                    throw error;
                }
            } 
            else {
                throw error;
            } 
        }
    }
    throw new Error("Max retries reached");
}

function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

//can return values of max and min
function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// pause for ms milliseconds
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}