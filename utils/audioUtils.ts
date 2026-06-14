/**
 * Decodes a base64 string into a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a base64 PCM string directly to an Int16Array.
 * Assumes 16-bit PCM Little Endian.
 */
export function base64ToInt16(base64: string): Int16Array {
  const rawBytes = decodeBase64(base64);
  // Create Int16Array view on the buffer
  return new Int16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2);
}

/**
 * Creates a buffer of silence for a specific duration.
 */
export function createSilence(seconds: number, sampleRate: number = 24000): Int16Array {
  const length = Math.floor(seconds * sampleRate);
  return new Int16Array(length); // Int16Array is initialized to 0s by default
}

/**
 * Concatenates multiple Int16Array buffers into a single buffer.
 */
export function concatenateBuffers(buffers: Int16Array[]): Int16Array {
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

/**
 * Wraps raw PCM data (from Gemini TTS) into a WAV file format so it can be played by browsers.
 * Gemini TTS typically returns 24kHz mono PCM.
 */
export function pcmToWav(pcmData: Int16Array | Float32Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  
  // Convert Float32 to Int16 if necessary
  let data: Int16Array;
  if (pcmData instanceof Float32Array) {
    data = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      // Clamp and scale
      let s = Math.max(-1, Math.min(1, pcmData[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      data[i] = s;
    }
  } else {
    data = pcmData;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const subChunk2Size = data.length * (bitsPerSample / 8);
  const chunkSize = 36 + subChunk2Size;

  const buffer = new ArrayBuffer(44 + subChunk2Size);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, subChunk2Size, true);

  // Write PCM samples
  const offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset + (i * 2), data[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Helper to convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g. "data:audio/wav;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}