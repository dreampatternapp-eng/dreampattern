import { Directory, File, Paths } from 'expo-file-system';

// Dream images live only on this phone, in the documents folder (included in the user's iCloud/device backup).
// The database stores just the file name, because the documents path can change between app updates.
const dir = () => new Directory(Paths.document, 'dream-images');

export function imageUri(file: string): string {
  return new File(dir(), file).uri;
}

export function writeImageFile(dreamId: string, base64: string): string {
  const d = dir();
  d.create({ idempotent: true, intermediates: true });
  // A new name each time so the Image component never shows a cached older picture.
  const name = `${dreamId}-${Date.now()}.jpg`;
  const f = new File(d, name);
  f.create({ overwrite: true });
  f.write(base64, { encoding: 'base64' });
  return name;
}

export function deleteImageFile(file: string): void {
  try {
    const f = new File(dir(), file);
    if (f.exists) f.delete();
  } catch {
    // Missing file: nothing to clean up.
  }
}

export function deleteAllImageFiles(): void {
  try {
    const d = dir();
    if (d.exists) d.delete();
  } catch {
    // Nothing to clean up.
  }
}

export function imageExists(file: string): boolean {
  try {
    return new File(dir(), file).exists;
  } catch {
    return false;
  }
}
