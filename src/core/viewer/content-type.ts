import { extensionOf } from './file-language'

/**
 * MIME type for the `weft-file://` byte protocol response. A correct
 * content-type is what makes Chromium route a `.pdf` to its built-in viewer and
 * decode images/media natively. Unknown → `application/octet-stream`.
 */
const MIME: Record<string, string> = {
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  apng: 'image/apng',
  svg: 'image/svg+xml',
  // Documents
  pdf: 'application/pdf',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska'
}

export function contentTypeForFile(name: string): string {
  return MIME[extensionOf(name)] ?? 'application/octet-stream'
}
