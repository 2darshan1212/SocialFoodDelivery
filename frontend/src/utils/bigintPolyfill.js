/**
 * BigInt Polyfill and Utility Functions
 * 
 * Provides safe BigInt operations and conversion utilities
 * to prevent "Cannot convert a BigInt value to a number" errors
 */

// Ensure global BigInt availability
if (typeof globalThis.BigInt === 'undefined') {
  console.warn('[BigInt Polyfill] BigInt not natively supported, loading polyfill...');
  
  // Simple BigInt polyfill for basic operations
  globalThis.BigInt = function(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) return num;
    }
    throw new TypeError('Cannot convert to BigInt');
  };
}

/**
 * Safely convert BigInt to Number
 * @param {BigInt|Number|String} value - Value to convert
 * @param {Number} defaultValue - Default value if conversion fails
 * @returns {Number} - Converted number
 */
export const safeBigIntToNumber = (value, defaultValue = 0) => {
  try {
    if (typeof value === 'bigint') {
      // Check if BigInt is within safe integer range
      const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
      const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
      
      if (value > MAX_SAFE_BIGINT || value < MIN_SAFE_BIGINT) {
        console.warn('[BigInt] Value exceeds safe integer range, using string representation');
        return parseFloat(value.toString());
      }
      
      return Number(value);
    }
    
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || defaultValue;
    
    return defaultValue;
  } catch (error) {
    console.error('[BigInt] Conversion error:', error);
    return defaultValue;
  }
};

/**
 * Safely convert Number to BigInt
 * @param {Number|String|BigInt} value - Value to convert
 * @returns {BigInt} - Converted BigInt
 */
export const safeNumberToBigInt = (value) => {
  try {
    if (typeof value === 'bigint') return value;
    
    // Convert to integer first to avoid decimal issues
    const intValue = typeof value === 'string' ? 
      parseInt(value, 10) : 
      Math.floor(Number(value));
    
    if (isNaN(intValue)) {
      throw new Error('Invalid number for BigInt conversion');
    }
    
    return BigInt(intValue);
  } catch (error) {
    console.error('[BigInt] Number to BigInt conversion error:', error);
    return BigInt(0);
  }
};

/**
 * Safe Math.pow operation that handles BigInt
 * @param {Number|BigInt} base - Base value
 * @param {Number|BigInt} exponent - Exponent value
 * @returns {Number} - Result as number
 */
export const safePow = (base, exponent) => {
  try {
    const numBase = safeBigIntToNumber(base);
    const numExponent = safeBigIntToNumber(exponent);
    
    const result = Math.pow(numBase, numExponent);
    
    // Check for infinity or NaN
    if (!isFinite(result)) {
      console.warn('[BigInt] Math.pow result is not finite, using fallback');
      return Number.MAX_SAFE_INTEGER;
    }
    
    return result;
  } catch (error) {
    console.error('[BigInt] Safe pow error:', error);
    return 1;
  }
};

/**
 * Safe Solana LAMPORTS conversion
 * @param {Number} solAmount - Amount in SOL
 * @param {Number} lamportsPerSol - LAMPORTS_PER_SOL constant
 * @returns {Number} - Amount in lamports as integer
 */
export const safeSOLToLamports = (solAmount, lamportsPerSol = 1000000000) => {
  try {
    // Ensure we're working with numbers
    const numSol = parseFloat(solAmount) || 0;
    const numLamports = parseInt(lamportsPerSol) || 1000000000;
    
    // Calculate lamports and round to avoid floating point issues
    const lamports = Math.round(numSol * numLamports);
    
    // Ensure result is a safe integer
    if (!Number.isSafeInteger(lamports)) {
      console.warn('[BigInt] Lamports calculation exceeds safe integer range');
      return Math.floor(lamports);
    }
    
    return lamports;
  } catch (error) {
    console.error('[BigInt] SOL to lamports conversion error:', error);
    return 0;
  }
};

/**
 * Safe Solana LAMPORTS to SOL conversion
 * @param {Number|BigInt} lamports - Amount in lamports
 * @param {Number} lamportsPerSol - LAMPORTS_PER_SOL constant
 * @returns {Number} - Amount in SOL
 */
export const safeLamportsToSOL = (lamports, lamportsPerSol = 1000000000) => {
  try {
    const numLamports = safeBigIntToNumber(lamports);
    const numLamportsPerSol = parseInt(lamportsPerSol) || 1000000000;
    
    return numLamports / numLamportsPerSol;
  } catch (error) {
    console.error('[BigInt] Lamports to SOL conversion error:', error);
    return 0;
  }
};

/**
 * Wrap Math operations to handle BigInt safely
 */
export const SafeMath = {
  pow: safePow,
  
  round: (value) => {
    try {
      return Math.round(safeBigIntToNumber(value));
    } catch (error) {
      console.error('[BigInt] Safe round error:', error);
      return 0;
    }
  },
  
  floor: (value) => {
    try {
      return Math.floor(safeBigIntToNumber(value));
    } catch (error) {
      console.error('[BigInt] Safe floor error:', error);
      return 0;
    }
  },
  
  ceil: (value) => {
    try {
      return Math.ceil(safeBigIntToNumber(value));
    } catch (error) {
      console.error('[BigInt] Safe ceil error:', error);
      return 0;
    }
  },
  
  min: (...values) => {
    try {
      const nums = values.map(v => safeBigIntToNumber(v));
      return Math.min(...nums);
    } catch (error) {
      console.error('[BigInt] Safe min error:', error);
      return 0;
    }
  },
  
  max: (...values) => {
    try {
      const nums = values.map(v => safeBigIntToNumber(v));
      return Math.max(...nums);
    } catch (error) {
      console.error('[BigInt] Safe max error:', error);
      return 0;
    }
  }
};

// Log successful initialization
console.log('[BigInt Polyfill] ✅ BigInt utilities initialized');

export default {
  safeBigIntToNumber,
  safeNumberToBigInt,
  safePow,
  safeSOLToLamports,
  safeLamportsToSOL,
  SafeMath
}; 