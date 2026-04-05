import iconv from 'iconv-lite';

// Encode string to Windows-1250 buffer
export function encodeWindows1250(content: string): Buffer {
  return iconv.encode(content, 'win1250');
}

// Decode Windows-1250 buffer to string
export function decodeWindows1250(buffer: Buffer): string {
  return iconv.decode(buffer, 'win1250');
}

// Detect and decode file content with auto-detection
export function decodeFileContent(buffer: Buffer): { content: string; encoding: string } {
  // Check for UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { content: buffer.toString('utf-8').substring(1), encoding: 'utf-8-bom' };
  }

  // Check for UTF-16 LE BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { content: iconv.decode(buffer, 'utf-16le'), encoding: 'utf-16le' };
  }

  // Check for UTF-16 BE BOM
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { content: iconv.decode(buffer, 'utf-16be'), encoding: 'utf-16be' };
  }

  // Try UTF-8 first
  const utf8Content = buffer.toString('utf-8');
  if (isValidUTF8(utf8Content)) {
    // Check if it contains Romanian chars properly
    if (/[ăâîșțĂÂÎȘȚ]/.test(utf8Content)) {
      return { content: utf8Content, encoding: 'utf-8' };
    }
  }

  // Try Windows-1250 (common for Romanian bank files)
  const win1250Content = iconv.decode(buffer, 'win1250');
  if (/[ăâîșțĂÂÎȘȚşţŞŢ]/.test(win1250Content)) {
    return { content: win1250Content, encoding: 'windows-1250' };
  }

  // Try ISO-8859-2 (Latin-2)
  const iso2Content = iconv.decode(buffer, 'iso-8859-2');
  if (/[ăâîșțĂÂÎȘȚ]/.test(iso2Content)) {
    return { content: iso2Content, encoding: 'iso-8859-2' };
  }

  // Fallback to UTF-8
  return { content: utf8Content, encoding: 'utf-8' };
}

// Basic UTF-8 validity check
function isValidUTF8(str: string): boolean {
  // Check for replacement characters which indicate invalid UTF-8
  return !str.includes('\uFFFD');
}

// Verify round-trip encoding integrity
export function verifyEncodingRoundTrip(original: string, encoding: string): boolean {
  try {
    const encoded = iconv.encode(original, encoding);
    const decoded = iconv.decode(encoded, encoding);
    return original === decoded;
  } catch {
    return false;
  }
}
