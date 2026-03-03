/**
 * Display Name Utility (Frontend)
 *
 * Backend validation:
 * /^[a-zA-Z][a-zA-Z0-9 _-]{1,29}$/
 */

const VALIDATION_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9 _-]{1,29}$/;

const FIRST_LETTER_REGEX = /[a-zA-Z]/;

/**
 * UX-level sanitization only.
 * Backend remains authoritative.
 */
export const sanitizeDisplayName = (
  displayName: string
): string => {

  if (!displayName || typeof displayName !== 'string') {
    return '';
  }

  let sanitized = displayName
    .trim()

    // Normalize accented characters
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')

    // Replace dots with spaces (preserves word boundaries in names like V.L.Name)
    .replaceAll('.', ' ')

    // Remove remaining unsupported characters
    .replaceAll(/[^a-zA-Z0-9\s\-_]/g, '')

    // Collapse whitespace
    .replaceAll(/\s+/g, ' ')
    .trim();

  // Prefer RegExp.exec() over match()
  const match = FIRST_LETTER_REGEX.exec(sanitized);

  if (match) {
    sanitized = sanitized.slice(match.index);
  }

  sanitized = sanitized.slice(0, 30).trim();

  if (sanitized.length < 2) {
    return 'User';
  }

  return sanitized;
};

/**
 * Backend-compatible validation
 */
export const isValidDisplayName = (
  displayName: string
): boolean => {
  return VALIDATION_PATTERN.test(displayName);
};

/**
 * Validation error helper
 */
export const getDisplayNameError = (
  displayName: string
): string => {

  if (!displayName?.trim())
    return 'Display name is required';

  if (displayName.length > 30)
    return 'Display name must be 30 characters or less';

  if (!/^[a-zA-Z]/.test(displayName))
    return 'Display name must start with a letter';

  if (displayName.length < 2)
    return 'Display name must be at least 2 characters';

  if (!VALIDATION_PATTERN.test(displayName))
    return 'Only letters, numbers, spaces, hyphens, or underscores are allowed';

  return '';
};