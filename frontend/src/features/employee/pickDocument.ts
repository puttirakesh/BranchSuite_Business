import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

export type PickedDocument = { name: string; mimeType: string; base64: string };

const mimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain'];
const mimeByExtension: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
export const maxDocumentBytes = 5 * 1024 * 1024;

function resolveMime(name: string, reported?: string | null) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = reported && reported !== 'application/octet-stream' ? reported : mimeByExtension[extension];
  if (!mimeType || !mimeTypes.includes(mimeType)) throw new Error('Choose a PDF, DOCX, PNG, JPEG or text file.');
  return mimeType;
}

/** Lets the employee choose a file and returns it as base64, or null when cancelled. */
export async function pickDocument(): Promise<PickedDocument | null> {
  if (Platform.OS === 'web') {
    const result = await DocumentPicker.getDocumentAsync({ type: mimeTypes });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxDocumentBytes) throw new Error('Choose a file no larger than 5 MB.');
    if (!asset.file) throw new Error('Could not read that file. Try choosing it again.');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read that file. Try choosing it again.'));
      reader.readAsDataURL(asset.file!);
    });
    return { name: asset.name, mimeType: resolveMime(asset.name, asset.mimeType), base64 };
  }

  const selection = await File.pickFileAsync({ mimeTypes });
  if (selection.canceled) return null;
  const file = selection.result;
  if (file.size && file.size > maxDocumentBytes) throw new Error('Choose a file no larger than 5 MB.');
  let base64: string;
  try {
    base64 = await file.base64();
  } catch {
    base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }).catch(() => {
      throw new Error('Could not read that file. Save it to your device and try again.');
    });
  }
  return { name: file.name, mimeType: resolveMime(file.name, file.type), base64 };
}
