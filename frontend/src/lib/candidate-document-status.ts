export function candidateDocumentStatusLabel(status: string): string {
  if (status.toUpperCase() === 'PENDING') return 'Uploaded';
  return status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}
