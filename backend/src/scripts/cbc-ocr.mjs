import { pdf } from 'pdf-to-img';
import { createWorker } from 'tesseract.js';

const filePath = process.argv[2];
if (!filePath) throw new Error('A PDF path is required');

const document = await pdf(filePath, { scale: 1.5 });
const worker = await createWorker('eng');
const pages = [];
let pageNumber = 0;

try {
  for await (const image of document) {
    pageNumber += 1;
    const result = await worker.recognize(image);
    pages.push(`\n-- OCR page ${pageNumber} --\n${result.data.text}`);
  }
} finally {
  await worker.terminate();
  await document.destroy();
}

process.stdout.write(JSON.stringify(pages.join('\n')));
