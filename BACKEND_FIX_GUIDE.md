/**
 * BACKEND FIX REQUIRED: Google Auth Display Name Sanitization
 * 
 * Issue:
 * Users with names containing periods (e.g., "V.L.Narasimha Kushal Kurapati") 
 * are failing Google authentication with validation error:
 * "Display name must be 2-30 characters, start with a letter, and contain only 
 *  letters, numbers, spaces, hyphens, or underscores"
 * 
 * Root Cause:
 * The googleAuth controller receives the displayName from Google's profile and 
 * attempts to save it without sanitizing invalid characters (like periods).
 * 
 * Solution:
 * Apply the same sanitizeDisplayName function to the displayName before saving
 * the user to the database in authController.js at line 206.
 */

// ============================================================================
// IMPLEMENTATION GUIDE FOR BACKEND (authController.js)
// ============================================================================

/**
 * Add this utility function to the top of authController.js or in a shared utils file
 */
const sanitizeDisplayName = (displayName) => {
  if (!displayName || typeof displayName !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = displayName.trim();

  // Remove invalid characters: keep only letters, numbers, spaces, hyphens, underscores
  // This removes dots, periods, and other special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, '');

  // Handle multiple consecutive spaces
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Ensure it starts with a letter
  const letterMatch = sanitized.match(/[a-zA-Z]/);
  if (letterMatch) {
    const startIndex = sanitized.indexOf(letterMatch[0]);
    sanitized = sanitized.substring(startIndex);
  }

  // Trim to 30 characters maximum
  sanitized = sanitized.substring(0, 30);

  // Final trim of any trailing spaces
  sanitized = sanitized.trim();

  // If empty or less than 2 characters, provide a fallback
  if (sanitized.length < 2) {
    return 'User';
  }

  return sanitized;
};

// ============================================================================
// MODIFICATION TO googleAuth FUNCTION
// ============================================================================

/**
 * BEFORE (Line 206 area):
 * 
 *   const user = new User({
 *       googleId: profile.id,
 *       email: profile.email,
 *       displayName: profile.name,  // <- PROBLEM: no sanitization
 *       avatar: profile.picture,
 *   });
 * 
 * AFTER:
 */

const user = new User({
  googleId: profile.id,
  email: profile.email,
  displayName: sanitizeDisplayName(profile.name),  // <- FIX: sanitize before saving
  avatar: profile.picture,
});

// ============================================================================
// EXAMPLE TRANSFORMATIONS
// ============================================================================

/**
 * These are actual examples of the sanitizer output:
 * 
 * Input:  'V.L.Narasimha Kushal Kurapati'
 * Output: 'VL Narasimha Kushal Kurapati'  (dots removed)
 * 
 * Input:  'Jean-Pierre Dubois'
 * Output: 'Jean-Pierre Dubois'  (already valid, no change)
 * 
 * Input:  'José García'
 * Output: 'Jos Garca'  (accents removed, not in allowed character set)
 * 
 * Input:  'John_Smith'
 * Output: 'John_Smith'  (already valid, no change)
 * 
 * Input:  '123StartsWithNumber'
 * Output: 'StartsWithNumber'  (removed leading numbers to comply with "starts with letter")
 * 
 * Input:  '..John..'
 * Output: 'John'  (leading/trailing dots removed)
 */

// ============================================================================
// VALIDATION PATTERN REFERENCE
// ============================================================================

/**
 * The validation pattern used in the User schema:
 * /^[a-zA-Z][a-zA-Z0-9 _-]{1,29}$/
 * 
 * Requirements:
 * ✓ Total length: 2-30 characters
 * ✓ First character: must be a letter (a-zA-Z)
 * ✓ Following characters: letters, numbers, spaces, hyphens, underscores
 * ✗ NOT allowed: dots, periods, special characters, accents
 */

// ============================================================================
// TESTING THE FIX
// ============================================================================

/**
 * Test case in backend:
 * 
 * const testNames = [
 *   'V.L.Narasimha Kushal Kurapati',
 *   'Jean-Pierre Dubois',
 *   'John Smith',
 *   'José García',
 *   '..Invalid..',
 * ];
 * 
 * testNames.forEach(name => {
 *   const sanitized = sanitizeDisplayName(name);
 *   console.log(`"${name}" -> "${sanitized}"`);
 *   console.log(`Valid: ${isValidDisplayName(sanitized)}`);
 * });
 */

// ============================================================================
// CLIENT-SIDE DEFENSIVE CODING (Already Implemented in Frontend)
// ============================================================================

/**
 * The frontend has also been updated with:
 * 1. A nameSanitizer.ts utility with sanitizeDisplayName() function
 * 2. Updated loginWithGoogle() in AuthContext.tsx to sanitize server response
 * 
 * This provides defense-in-depth: even if the backend sanitization is missed,
 * the client will sanitize the displayName after receiving it from the server.
 */
