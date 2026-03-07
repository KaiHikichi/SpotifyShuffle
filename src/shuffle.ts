import express from 'express';
import axios, { all } from 'axios';
import querystring from 'querystring';
import * as fs from "fs";
import dotenv from "dotenv";
dotenv.config();


const client_id = 'e3a553fd98884511a92136d15b9c1cf3';
const client_secret = process.env.client_secret;
const redirect_uri = 'http://127.0.0.1:8888/callback';
const playlist_id = '4d3BQUdCNhgBOKbNde214u';
let access_token = '';
const port = 8888;


//run the server
const app = express();
app.listen(port, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
});

//interfaces////////////////////////////////////////////////////////////////////////////////
interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
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
        res.redirect('http://127.0.0.1:8888/shuffle');
    } 
    catch (error: unknown) {
        handleError(error, "/callback");
        res.status(500).send("Server error in /callback");
    }
});

//shuffle page
app.get('/shuffle', async (req, res) => {

    try {
        let allTracks: SpotifyTrack[] = await getAllSavedTracks(req, res);
        printTracks(allTracks, "out/songs.txt");
        

    } 
    catch (error: unknown) {
        handleError(error, "/shuffle");
        res.status(500).send("Server error in /shuffle");
    }
});
















//helpers////////////////////////////////////////////

//gets all active instances of Spotify (must be open or playing music)
async function getDevices(): Promise<SpotifyDeviceObject[]> {
    let devices: SpotifyDeviceObject[] = [];
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        devices = response.data.devices;
        return devices;

    } catch (error: unknown) {
        handleError(error, "Devices");
    }

    return devices;
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

    try {
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

    } catch (error: unknown) {
        //handle API rate limits
        if (axios.isAxiosError(error) && error.response?.status == 429) {
            const retryAfterHeader = error.response?.headers['retry-after'];
            const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
            console.warn(`Rate limited. Wait for ${waitSeconds} seconds before retrying get saved tracks.`);
            await sleep(waitSeconds * 1000);
            return await getSavedTracks(offset);
        }
        else{
            handleError(error, "Tracks");
        }
        
        
    }
    return tracks;
}

//put all songs in user's liked songs in an array
async function getAllSavedTracks(req: express.Request, res: express.Response): Promise<SpotifyTrack[]> {
    let offset = 0;
    let allTracks: SpotifyTrack[] = [];
    let tempTracks = await getSavedTracks(offset);

    //push each batch of 50
    while(tempTracks.length == 50){
        //push each track to allTracks array
        tempTracks.forEach(item => {
            allTracks.push(item);
        });
        offset = offset + 50;
        tempTracks = await getSavedTracks(offset);
    }
    //push final batch
    tempTracks.forEach(item => {
        allTracks.push(item);
    });

    return allTracks;
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

function handleError(error: unknown, source: string){
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
    console.error(`From: ${source}`);
}

function generateRandomString(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// pause for ms milliseconds
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}