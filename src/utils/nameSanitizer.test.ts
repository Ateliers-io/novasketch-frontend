import { describe, it, expect } from 'vitest';
import { sanitizeDisplayName, isValidDisplayName, getDisplayNameError } from './nameSanitizer';

describe('Name Sanitizer', () => {
  describe('sanitizeDisplayName', () => {
    it('should remove periods from names with initials', () => {
      const result = sanitizeDisplayName('V.L.Narasimha Kushal Kurapati');
      expect(result).toBe('V L Narasimha Kushal Kurapati');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should preserve hyphenated names', () => {
      const result = sanitizeDisplayName('Jean-Pierre Dubois');
      expect(result).toBe('Jean-Pierre Dubois');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should preserve underscored names', () => {
      const result = sanitizeDisplayName('John_Smith');
      expect(result).toBe('John_Smith');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should remove special characters and accents', () => {
      const result = sanitizeDisplayName('José García');
      expect(result).toBe('Jose Garcia');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should remove leading and trailing dots', () => {
      const result = sanitizeDisplayName('..John..');
      expect(result).toBe('John');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should remove leading numbers to start with letter', () => {
      const result = sanitizeDisplayName('123StartsWithNumber');
      expect(result).toBe('StartsWithNumber');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should collapse multiple spaces', () => {
      const result = sanitizeDisplayName('John    Doe');
      expect(result).toBe('John Doe');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = sanitizeDisplayName('  John Doe  ');
      expect(result).toBe('John Doe');
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should truncate names longer than 30 characters', () => {
      const longName = 'VeryVeryVeryVeryVeryVeryVeryLongName';
      const result = sanitizeDisplayName(longName);
      expect(result.length).toBeLessThanOrEqual(30);
      expect(isValidDisplayName(result)).toBe(true);
    });

    it('should return "User" for empty or invalid names', () => {
      expect(sanitizeDisplayName('')).toBe('User');
      expect(sanitizeDisplayName('   ')).toBe('User');
      expect(sanitizeDisplayName('..')).toBe('User');
      expect(sanitizeDisplayName('123')).toBe('User');
    });

    it('should handle null or undefined gracefully', () => {
      expect(sanitizeDisplayName(null as any)).toBe('');
      expect(sanitizeDisplayName(undefined as any)).toBe('');
    });

    it('should preserve valid names unchanged', () => {
      const validNames = [
        'John Doe',
        'Alice Smith',
        'Bob-Jane',
        'User_Name123',
      ];
      validNames.forEach(name => {
        const result = sanitizeDisplayName(name);
        expect(result).toBe(name);
        expect(isValidDisplayName(result)).toBe(true);
      });
    });
  });

  describe('isValidDisplayName', () => {
    it('should validate correct names', () => {
      expect(isValidDisplayName('John Doe')).toBe(true);
      expect(isValidDisplayName('Alice')).toBe(true);
      expect(isValidDisplayName('Bob-Jane')).toBe(true);
      expect(isValidDisplayName('User_Name')).toBe(true);
    });

    it('should reject names with periods', () => {
      expect(isValidDisplayName('J.D. Smith')).toBe(false);
    });

    it('should reject names starting with numbers', () => {
      expect(isValidDisplayName('1John')).toBe(false);
    });

    it('should reject names with special characters', () => {
      expect(isValidDisplayName('John@Doe')).toBe(false);
      expect(isValidDisplayName('User#123')).toBe(false);
    });

    it('should reject names shorter than 2 characters', () => {
      expect(isValidDisplayName('J')).toBe(false);
    });

    it('should reject names longer than 30 characters', () => {
      expect(isValidDisplayName('A' + 'B'.repeat(30))).toBe(false);
    });

    it('should reject empty names', () => {
      expect(isValidDisplayName('')).toBe(false);
    });
  });

  describe('getDisplayNameError', () => {
    it('should return appropriate error messages', () => {
      expect(getDisplayNameError('')).toBe('Display name is required');
      expect(getDisplayNameError('J')).toBe('Display name must be at least 2 characters');
      expect(getDisplayNameError('A' + 'B'.repeat(30))).toBe('Display name must be 30 characters or less');
      expect(getDisplayNameError('1John')).toBe('Display name must start with a letter');
      expect(getDisplayNameError('John.Doe')).toBe('Only letters, numbers, spaces, hyphens, or underscores are allowed');
    });

    it('should return empty string for valid names', () => {
      expect(getDisplayNameError('John Doe')).toBe('');
      expect(getDisplayNameError('Alice')).toBe('');
    });
  });
});
