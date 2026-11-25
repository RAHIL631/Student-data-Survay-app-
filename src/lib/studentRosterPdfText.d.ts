export type StudentPdfTextFragment = { text: string; x: number; y: number };
export function extractNamesFromTextFragments(fragments: StudentPdfTextFragment[]): string[];
