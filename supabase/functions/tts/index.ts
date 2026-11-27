// Supabase Edge Function: tts
// Read aloud (Feature 4): gets the voice AND the time of every word from Azure Speech.
// - Only logged-in users can use it (protects our free Azure limit).
// - Each result is saved in the PRIVATE "tts-audio" folder, so reading the same text
//   again uses the saved copy and costs no Azure characters.
// - The app gets the audio through a link that expires after 1 hour.
// The Azure key comes from Supabase Secrets. It is never inside the app.

import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Child voice first (nice for kids); a common adult voice as backup
const VOICES = ['en-US-AnaNeural', 'en-US-JennyNeural'];
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const BUCKET = 'tts-audio';
const MAX_TEXT_LENGTH = 6000; // about 2-3 pages (same as simplify)
const LINK_SECONDS = 3600; // audio link works for 1 hour
const TIMEOUT_MS = 60000;
// Reading speed (Feature 5): 0 = Slow, 1 = Normal, 2 = Fast.
// rate is how Azure changes the speed; name is the folder for the saved copies.
const SPEEDS = [
  { name: 'slow', rate: '-50%' }, // 0.5x (Azure's slowest)
  { name: 'normal', rate: '-25%' }, // 0.75x
  { name: 'fast', rate: '0%' }, // 1x
];
type Speed = (typeof SPEEDS)[number];

const NOT_ANSWERING = 'The reading voice is not answering. Please try again.';

type Word = { word: string; startMs: number; durationMs: number };

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// 32 letters/numbers, no dashes (Azure's id format)
const newId = () => crypto.randomUUID().replaceAll('-', '');

// Make the text safe to put inside SSML (XML)
const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Code name for a saved file: nobody can tell the page text from it
async function codeName(text: string, speed: Speed) {
  const bytes = new TextEncoder().encode(`${VOICES.join(',')}|${speed.rate}|${text}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Read one header (like "Path") from Azure's message header text
const headerValue = (head: string, name: string) => {
  for (const line of head.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon > 0 && line.slice(0, colon).trim().toLowerCase() === name.toLowerCase()) {
      return line.slice(colon + 1).trim();
    }
  }
  return '';
};

const joinBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const all = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
};

// Swap the secret key for a short-lived Azure token (10 minutes)
async function getToken(region: string, key: string) {
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
  });
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }
  return res.text();
}

// Open Azure's live connection, send the text, collect the audio + word times
function synthesize(region: string, token: string, text: string, voice: string, speed: Speed) {
  return new Promise<{ audio: Uint8Array; words: Word[] }>((resolve, reject) => {
    const requestId = newId();
    const url =
      `wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1` +
      `?Authorization=${encodeURIComponent('Bearer ' + token)}&X-ConnectionId=${newId()}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    const audioParts: Uint8Array[] = [];
    const words: Word[] = [];
    let finished = false;

    const finish = (action: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      action();
    };
    const fail = (error: Error) => finish(() => reject(error));
    const timer = setTimeout(
      () => fail(new Error(`Azure did not finish within ${TIMEOUT_MS / 1000} seconds`)),
      TIMEOUT_MS
    );

    const send = (path: string, contentType: string, body: string, withRequestId: boolean) => {
      const head = [
        withRequestId ? `X-RequestId:${requestId}` : '',
        `X-Timestamp:${new Date().toISOString()}`,
        `Content-Type:${contentType}`,
        `Path:${path}`,
      ]
        .filter((line) => line !== '')
        .join('\r\n');
      ws.send(`${head}\r\n\r\n${body}`);
    };

    ws.onopen = () => {
      send(
        'speech.config',
        'application/json; charset=utf-8',
        JSON.stringify({
          context: {
            system: { name: 'SpeechSDK', version: '1.0.0', build: 'JavaScript', lang: 'JavaScript' },
            os: { platform: 'Server', name: 'Deno', version: '1' },
          },
        }),
        false
      );
      send(
        'synthesis.context',
        'application/json',
        JSON.stringify({
          synthesis: {
            audio: {
              metadataOptions: {
                bookmarkEnabled: false,
                punctuationBoundaryEnabled: false,
                sentenceBoundaryEnabled: false,
                wordBoundaryEnabled: true, // ask Azure for the time of every word
              },
              outputFormat: OUTPUT_FORMAT,
            },
            language: { autoDetection: false },
          },
        }),
        true
      );
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
        `<voice name="${voice}"><prosody rate="${speed.rate}">${escapeXml(text)}</prosody></voice></speak>`;
      send('ssml', 'application/ssml+xml', ssml, true);
    };

    ws.onmessage = (event: MessageEvent) => {
      // Text message: word times ("audio.metadata") or the end ("turn.end")
      if (typeof event.data === 'string') {
        const split = event.data.indexOf('\r\n\r\n');
        const head = split >= 0 ? event.data.slice(0, split) : event.data;
        const body = split >= 0 ? event.data.slice(split + 4) : '';
        const path = headerValue(head, 'Path');

        if (path === 'audio.metadata') {
          try {
            const meta = JSON.parse(body);
            for (const item of meta.Metadata ?? []) {
              if (item.Type === 'WordBoundary') {
                // Azure times are in 100-nanosecond steps: divide by 10,000 for milliseconds
                words.push({
                  word: item.Data?.text?.Text ?? '',
                  startMs: Math.round((item.Data?.Offset ?? 0) / 10000),
                  durationMs: Math.round((item.Data?.Duration ?? 0) / 10000),
                });
              }
            }
          } catch {
            // ignore a message we cannot read
          }
        } else if (path === 'turn.end') {
          finish(() => resolve({ audio: joinBytes(audioParts), words }));
        }
        return;
      }

      // Binary message: [2 bytes header length][header text][audio bytes]
      const data = new Uint8Array(event.data as ArrayBuffer);
      if (data.length < 2) return;
      const headLength = (data[0] << 8) | data[1];
      const head = new TextDecoder().decode(data.slice(2, 2 + headLength));
      if (headerValue(head, 'Path') === 'audio') {
        audioParts.push(data.slice(2 + headLength));
      }
    };

    ws.onerror = () => fail(new Error('Live connection error (Azure refused or dropped the connection)'));
    ws.onclose = (event: CloseEvent) => {
      if (!finished) fail(new Error(`Azure closed the connection: code ${event.code} ${event.reason}`));
    };
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return reply({ error: 'Please send a POST request.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const azureKey = Deno.env.get('AZURE_SPEECH_KEY');
  const region = Deno.env.get('AZURE_SPEECH_REGION');
  if (!supabaseUrl || !serviceKey || !azureKey || !region) {
    return reply({ error: 'Read aloud is not set up on the server.' }, 500);
  }

  // Server-only client (can use the private folder). Never sent to the app.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Only logged-in users
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return reply({ error: 'Please log in first.' }, 401);
  }

  // 2. Check the text and the speed (0 = Slow, 1 = Normal, 2 = Fast; anything else = Normal)
  let text = '';
  let speed: Speed = SPEEDS[1];
  try {
    const body = await req.json();
    text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (body?.speed === 0 || body?.speed === 1 || body?.speed === 2) speed = SPEEDS[body.speed];
  } catch {
    // handled below
  }
  if (text === '') {
    return reply({ error: 'No text was sent.' }, 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return reply({ error: 'This page is too long to read aloud. Please try a shorter page.' }, 413);
  }

  const folder = admin.storage.from(BUCKET);
  const base = `${speed.name}/${await codeName(text, speed)}`;

  // 3. Already saved? Use the saved copy (free)
  try {
    const saved = await folder.download(`${base}.json`);
    if (saved.data) {
      const info = JSON.parse(await saved.data.text());
      const link = await folder.createSignedUrl(`${base}.mp3`, LINK_SECONDS);
      if (link.data?.signedUrl && Array.isArray(info.words)) {
        return reply({ audioUrl: link.data.signedUrl, words: info.words, voice: info.voice, cached: true });
      }
    }
  } catch {
    // not saved yet (or unreadable): make it again below
  }

  // 4. Not saved: ask Azure
  let azureToken: string;
  try {
    azureToken = await getToken(region, azureKey);
  } catch (e) {
    console.log('tts token error:', String(e));
    return reply({ error: NOT_ANSWERING }, 502);
  }

  const problems: string[] = [];
  for (const voice of VOICES) {
    try {
      const { audio, words } = await synthesize(region, azureToken, text, voice, speed);
      if (audio.length === 0) {
        problems.push(`${voice}: no audio came back`);
        continue;
      }

      // 5. Save the audio and word times, then send a 1-hour link
      const audioSave = await folder.upload(`${base}.mp3`, audio, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
      if (audioSave.error) throw new Error(`Saving audio failed: ${audioSave.error.message}`);

      const infoSave = await folder.upload(
        `${base}.json`,
        new Blob([JSON.stringify({ voice, words })], { type: 'application/json' }),
        { contentType: 'application/json', upsert: true }
      );
      if (infoSave.error) console.log('tts: saving word times failed:', infoSave.error.message);

      const link = await folder.createSignedUrl(`${base}.mp3`, LINK_SECONDS);
      if (!link.data?.signedUrl) throw new Error('Could not make the audio link');

      return reply({ audioUrl: link.data.signedUrl, words, voice, cached: false });
    } catch (e) {
      problems.push(`${voice}: ${String(e)}`);
    }
  }

  console.log('tts failed:', problems);
  return reply({ error: NOT_ANSWERING }, 502);
});
