import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractNamesFromTextFragments } from './studentRosterPdfText.js';
import { normalizeStudentNames } from './studentRosters.js';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type TextFragment = { text: string; x: number; y: number };

export async function extractStudentNamesFromPdf(file: File): Promise<string[]> {
  if (file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a PDF file.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('The PDF must be 20 MB or smaller.');
  }

  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await loadingTask.promise;
  if (document.numPages > 100) {
    await loadingTask.destroy();
    throw new Error('The PDF must contain 100 pages or fewer. Split the student list into smaller files.');
  }

  const extractedNames: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const fragments: TextFragment[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        fragments.push({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] });
      }
      extractedNames.push(...extractNamesFromTextFragments(fragments));
    }
  } finally {
    await loadingTask.destroy();
  }

  const names = normalizeStudentNames(extractedNames);
  if (names.length === 0) {
    throw new Error('No selectable student names were found. This may be a scanned PDF; use a text-based PDF or enter names manually.');
  }
  if (names.length > 5000) {
    throw new Error('This PDF contains more than 5,000 unique names. Split it into smaller student lists.');
  }
  return names;
}
