import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export async function generatePdfFromHtml(html: string, fileName: string): Promise<string> {
  // Expo Print can fail with a network error while resolving remote logos/fonts.
  // The report remains complete without those optional external assets.
  const printableHtml = html
    .replace(/<img\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*>/gi, '');
  const { uri } = await Print.printToFileAsync({ html: printableHtml });
  const fileUri = FileSystem.documentDirectory + fileName;
  await FileSystem.copyAsync({ from: uri, to: fileUri });
  return fileUri;
}

export async function sharePdfFile(fileUri: string, dialogTitle: string): Promise<void> {
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
}

export async function downloadAndShareReportCardHtml(
  html: string,
  fileName: string,
  dialogTitle: string,
): Promise<void> {
  const fileUri = await generatePdfFromHtml(html, fileName);
  await sharePdfFile(fileUri, dialogTitle);
}
