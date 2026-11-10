// Split text into speakable chunks. Chrome voices stall on utterances longer
// than ~15 s, so they get short chunks; Gemini gets longer ones to cut calls.
export function chunkText(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const p = para.trim();
    if (!p) continue;
    const sentences = p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [p];
    let cur = '';
    for (const s of sentences) {
      if (cur && (cur + s).length > max) {
        out.push(cur.trim());
        cur = '';
      }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.flatMap((c) => (c.length <= max * 1.4 ? [c] : splitWords(c, max)));
}

function splitWords(c: string, max: number): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const w of c.split(' ')) {
    if (cur && cur.length + w.length > max) {
      parts.push(cur);
      cur = '';
    }
    cur += (cur ? ' ' : '') + w;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Wrap headerless 16-bit mono PCM in a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Blob {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: 'audio/wav' });
}

export function base64ToAudioBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // RIFF
  return isWav ? new Blob([bytes], { type: 'audio/wav' }) : pcmToWav(bytes);
}
