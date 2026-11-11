// Supabase Edge Function: ocr
// Gets a photo (or PDF) from the app, asks OCR.space to read it, and sends back the text.
// The OCR.space key comes from Supabase Secrets. It is never inside the app.

const OCR_URL = 'https://api.ocr.space/parse/image';
const MAX_BASE64_LENGTH = 1_360_000; // about 1 MB file (OCR.space free limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return reply({ error: 'Please send a POST request.' }, 405);
  }

  const apiKey = Deno.env.get('OCR_SPACE_API_KEY');
  if (!apiKey) {
    return reply({ error: 'OCR key is missing on the server.' }, 500);
  }

  let body: { base64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'No image was sent.' }, 400);
  }

  const base64 = body.base64;
  const type = body.mimeType ?? 'image/jpeg';

  if (!base64) {
    return reply({ error: 'No image was sent.' }, 400);
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return reply({ error: 'Only photos and PDFs can be read.' }, 400);
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return reply({ error: 'This file is too big. Please use a file under 1 MB.' }, 413);
  }

  const form = new FormData();
  form.append('apikey', apiKey);
  form.append('base64Image', `data:${type};base64,${base64}`);
  form.append('language', 'eng');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  form.append('detectOrientation', 'true');

  try {
    const res = await fetch(OCR_URL, { method: 'POST', body: form });
    const data = await res.json();

    if (data.IsErroredOnProcessing) {
      console.log('OCR.space error:', data.ErrorMessage);
      return reply({ error: 'We could not read this page. Please try another photo.' }, 502);
    }

    const text = (data.ParsedResults ?? [])
      .map((page: { ParsedText?: string }) => page.ParsedText ?? '')
      .join('\n\n')
      .trim();

    return reply({ text });
  } catch (e) {
    console.log('OCR request failed:', e);
    return reply({ error: 'The reading service is not answering. Please try again.' }, 502);
  }
});
