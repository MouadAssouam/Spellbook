// kiro-generated
/**
 * Enhanced Validation Functions
 * 
 * Provides validation with helpful error messages and examples.
 */

/**
 * Validates spell name with enhanced error messages.
 * 
 * @param value - Name to validate
 * @returns Error message or null if valid
 */
export function validateSpellName(value: string): string | null {
  if (!value) {
    return 'Name is required';
  }
  
  if (value.length < 3) {
    return `Name must be at least 3 characters (currently ${value.length}). Example: api-client`;
  }
  
  if (value.length > 50) {
    return `Name must be at most 50 characters (currently ${value.length})`;
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(value)) {
    return 'Name must contain only letters, numbers, and hyphens. Example: github-fetcher';
  }
  
  return null;
}

/**
 * Validates description with character count feedback.
 * 
 * @param value - Description to validate
 * @returns Error message or null if valid
 */
export function validateDescription(value: string): string | null {
  if (!value) {
    return 'Description is required';
  }
  
  const length = value.length;
  
  if (length < 100) {
    return `Description must be at least 100 characters (currently ${length}). Add more details about what the tool does.`;
  }
  
  if (length > 500) {
    return `Description must be at most 500 characters (currently ${length}). Please shorten it.`;
  }
  
  return null;
}

/**
 * Validates URL with format hints.
 * 
 * @param value - URL to validate
 * @returns Error message or null if valid
 */
export function validateUrl(value: string): string | null {
  if (!value) {
    return 'URL is required';
  }
  
  try {
    // Remove {{placeholders}} for validation
    const testUrl = value.replace(/\{\{[^}]+\}\}/g, 'test');
    new URL(testUrl);
    return null;
  } catch {
    return 'Invalid URL format. Example: https://api.example.com/data or https://api.example.com/{{resource}}';
  }
}
