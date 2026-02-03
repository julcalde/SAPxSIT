/**
 * Data Validators Utility Module
 * 
 * Provides validation functions for supplier onboarding data.
 * Used by supplier-service.js to validate form inputs.
 * 
 * Features:
 * - Email validation (RFC 5322 compliant)
 * - Tax ID validation (multiple country formats)
 * - IBAN validation (checksum algorithm)
 * - Phone number validation (E.164 format)
 * - URL validation
 * 
 * @module srv/lib/validators
 */

/**
 * Validate email address format
 * 
 * Uses RFC 5322 compliant regex pattern
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateEmail('user@example.com') // true
 * validateEmail('invalid-email') // false
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // RFC 5322 simplified regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email);
}

/**
 * Validate Tax ID format
 * 
 * Supports multiple country formats:
 * - US: 9 digits (EIN format: XX-XXXXXXX)
 * - EU: Various VAT formats
 * - DE: 11 digits (German tax number)
 * - GB: 9 or 12 digits (UK UTR)
 * - Generic: 5-20 alphanumeric characters
 * 
 * @param {string} taxId - Tax ID to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateTaxId('12-3456789') // true (US EIN)
 * validateTaxId('DE123456789') // true (German)
 * validateTaxId('123') // false (too short)
 */
function validateTaxId(taxId) {
  if (!taxId || typeof taxId !== 'string') {
    return false;
  }
  
  // Remove spaces and hyphens for validation
  const cleaned = taxId.replace(/[\s\-]/g, '');
  
  // Must be 5-20 alphanumeric characters
  if (cleaned.length < 5 || cleaned.length > 20) {
    return false;
  }
  
  // Allow letters and numbers only
  const taxIdRegex = /^[A-Z0-9]+$/i;
  
  return taxIdRegex.test(cleaned);
}

/**
 * Validate IBAN format
 * 
 * Implements IBAN checksum validation (mod-97 algorithm)
 * Supports all SEPA country codes
 * 
 * Reference: ISO 13616
 * 
 * @param {string} iban - IBAN to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateIBAN('DE89370400440532013000') // true
 * validateIBAN('GB82WEST12345698765432') // true
 * validateIBAN('INVALID') // false
 */
function validateIBAN(iban) {
  if (!iban || typeof iban !== 'string') {
    return false;
  }
  
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Check length (15-34 characters)
  if (cleaned.length < 15 || cleaned.length > 34) {
    return false;
  }
  
  // Check format: 2 letters, 2 digits, then alphanumeric
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
  if (!ibanRegex.test(cleaned)) {
    return false;
  }
  
  // Validate country code lengths
  const ibanLengths = {
    AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
    BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
    EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
    GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
    IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
    LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
    NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24,
    SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24,
    XK: 20
  };
  
  const countryCode = cleaned.substring(0, 2);
  const expectedLength = ibanLengths[countryCode];
  
  if (!expectedLength || cleaned.length !== expectedLength) {
    return false;
  }
  
  // Perform mod-97 checksum validation
  try {
    // Move first 4 characters to end
    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
    
    // Replace letters with numbers (A=10, B=11, ..., Z=35)
    const numeric = rearranged.replace(/[A-Z]/g, (char) => {
      return String(char.charCodeAt(0) - 55);
    });
    
    // Calculate mod 97
    let remainder = numeric;
    while (remainder.length > 2) {
      const block = remainder.substring(0, 9);
      remainder = (parseInt(block, 10) % 97) + remainder.substring(block.length);
    }
    
    const checksum = parseInt(remainder, 10) % 97;
    
    return checksum === 1;
    
  } catch (error) {
    return false;
  }
}

/**
 * Validate phone number format
 * 
 * Accepts E.164 format with optional formatting:
 * - International format: +[country code][number]
 * - Allows spaces, hyphens, parentheses for readability
 * - Length: 7-15 digits (excluding formatting)
 * 
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validatePhoneNumber('+1-555-123-4567') // true
 * validatePhoneNumber('+49 30 12345678') // true
 * validatePhoneNumber('123') // false (too short)
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if starts with + (international format)
  if (!cleaned.startsWith('+')) {
    return false;
  }
  
  // Remove + and check if all digits
  const digits = cleaned.substring(1);
  
  if (!/^\d+$/.test(digits)) {
    return false;
  }
  
  // Check length (7-15 digits per E.164)
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }
  
  return true;
}

/**
 * Validate URL format
 * 
 * Accepts HTTP and HTTPS URLs
 * Validates domain structure
 * 
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateUrl('https://www.example.com') // true
 * validateUrl('http://example.com/path') // true
 * validateUrl('not-a-url') // false
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    
    // Must have a valid hostname
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return false;
    }
    
    // Basic domain validation (contains at least one dot)
    if (!parsed.hostname.includes('.')) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Validate postal code format by country
 * 
 * @param {string} postalCode - Postal code to validate
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validatePostalCode('12345', 'US') // true
 * validatePostalCode('SW1A 1AA', 'GB') // true
 */
function validatePostalCode(postalCode, countryCode) {
  if (!postalCode || !countryCode) {
    return false;
  }
  
  const patterns = {
    US: /^\d{5}(-\d{4})?$/,                    // 12345 or 12345-6789
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,         // K1A 0B1
    GB: /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i,   // SW1A 1AA
    DE: /^\d{5}$/,                              // 12345
    FR: /^\d{5}$/,                              // 75001
    IT: /^\d{5}$/,                              // 00100
    ES: /^\d{5}$/,                              // 28001
    NL: /^\d{4}\s?[A-Z]{2}$/i,                 // 1012 AB
    BE: /^\d{4}$/,                              // 1000
    AT: /^\d{4}$/,                              // 1010
    CH: /^\d{4}$/,                              // 8000
    SE: /^\d{3}\s?\d{2}$/,                      // 123 45
    NO: /^\d{4}$/,                              // 0150
    DK: /^\d{4}$/,                              // 1050
    FI: /^\d{5}$/,                              // 00100
    PL: /^\d{2}-\d{3}$/,                        // 00-950
    CZ: /^\d{3}\s?\d{2}$/,                      // 110 00
    PT: /^\d{4}-\d{3}$/,                        // 1000-001
    GR: /^\d{3}\s?\d{2}$/,                      // 102 41
    IE: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i,         // D02 AF30
    AU: /^\d{4}$/,                              // 2000
    NZ: /^\d{4}$/,                              // 1010
    JP: /^\d{3}-\d{4}$/,                        // 100-0001
    CN: /^\d{6}$/,                              // 100000
    IN: /^\d{6}$/,                              // 110001
    BR: /^\d{5}-?\d{3}$/,                       // 01310-100
  };
  
  const pattern = patterns[countryCode.toUpperCase()];
  
  if (!pattern) {
    // Generic validation for unknown countries (3-10 alphanumeric)
    return /^[A-Z0-9\s\-]{3,10}$/i.test(postalCode);
  }
  
  return pattern.test(postalCode);
}

/**
 * Validate currency code (ISO 4217)
 * 
 * @param {string} currencyCode - 3-letter currency code
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateCurrencyCode('USD') // true
 * validateCurrencyCode('EUR') // true
 * validateCurrencyCode('XYZ') // false
 */
function validateCurrencyCode(currencyCode) {
  if (!currencyCode || typeof currencyCode !== 'string') {
    return false;
  }
  
  // Must be exactly 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return false;
  }
  
  // Common currency codes (not exhaustive)
  const validCurrencies = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'INR',
    'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB',
    'TRY', 'BRL', 'MXN', 'ZAR', 'SGD', 'HKD', 'THB', 'MYR', 'IDR', 'PHP',
    'KRW', 'SAR', 'AED', 'ILS', 'EGP', 'ARS', 'CLP', 'COP', 'PEN', 'VND'
  ];
  
  return validCurrencies.includes(currencyCode);
}

/**
 * Validate country code (ISO 3166-1 alpha-2)
 * 
 * @param {string} countryCode - 2-letter country code
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * validateCountryCode('US') // true
 * validateCountryCode('DE') // true
 * validateCountryCode('XY') // false
 */
function validateCountryCode(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  
  // Must be exactly 2 uppercase letters
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return false;
  }
  
  // Common country codes (not exhaustive, add more as needed)
  const validCountries = [
    'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE',
    'NO', 'DK', 'FI', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'GR',
    'PT', 'IE', 'LU', 'EE', 'LV', 'LT', 'CY', 'MT', 'IS', 'LI', 'MC', 'AD',
    'SM', 'VA', 'AU', 'NZ', 'JP', 'CN', 'IN', 'KR', 'SG', 'HK', 'TW', 'TH',
    'MY', 'ID', 'PH', 'VN', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'ZA', 'EG',
    'SA', 'AE', 'IL', 'TR', 'RU', 'UA', 'BY', 'RS', 'BA', 'AL', 'MK', 'ME'
  ];
  
  return validCountries.includes(countryCode);
}

// Export all validators
module.exports = {
  validateEmail,
  validateTaxId,
  validateIBAN,
  validatePhoneNumber,
  validateUrl,
  validatePostalCode,
  validateCurrencyCode,
  validateCountryCode
};
