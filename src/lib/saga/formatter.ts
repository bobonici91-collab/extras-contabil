// Format date as DD.MM.YYYY for SAGA
export function formatDateSAGA(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Format amount in Romanian format: 1.234,56
export function formatAmountSAGA(amount: number): string {
  if (amount === 0) return '';

  // Round to exactly 2 decimal places
  const rounded = Math.round(amount * 100) / 100;

  // Split into integer and decimal parts
  const parts = rounded.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Add thousands separator (.)
  let formatted = '';
  let count = 0;
  for (let i = intPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = intPart[i] + formatted;
    count++;
  }

  // Use comma as decimal separator
  return `${formatted},${decPart}`;
}

// Sanitize description for SAGA import
export function sanitizeDescription(desc: string): string {
  if (!desc) return '';

  let cleaned = desc;

  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Replace line breaks with spaces
  cleaned = cleaned.replace(/[\r\n]+/g, ' ');

  // Replace semicolons with commas (since semicolon is the delimiter)
  cleaned = cleaned.replace(/;/g, ',');

  // Replace double quotes with single quotes
  cleaned = cleaned.replace(/"/g, "'");

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Normalize Romanian diacritics (old form to new form)
  cleaned = cleaned.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș');
  cleaned = cleaned.replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț');

  // Truncate to reasonable length (SAGA has limits)
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }

  return cleaned;
}
