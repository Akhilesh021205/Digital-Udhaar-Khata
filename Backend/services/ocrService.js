const { createWorker } = require('tesseract.js');

/**
 * Extracts real UTR / Ref. No. from Base64 payment screenshot image using Tesseract OCR + Regex Matching
 * @param {string} base64Image - Data URL or Base64 string of the payment screenshot
 * @returns {Promise<string|null>} - Extracted 12-digit UTR or null
 */
const extractUtrFromScreenshot = async (base64Image) => {
  if (!base64Image) return null;

  try {
    // 1. Prepare base64 buffer or data URI
    let imageInput = base64Image;
    if (base64Image.startsWith('data:image')) {
      const base64Data = base64Image.split(',')[1];
      imageInput = Buffer.from(base64Data, 'base64');
    }

    // 2. Perform OCR using Tesseract.js (English model)
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageInput);
    await worker.terminate();

    console.log('--- OCR Extracted Text Start ---');
    console.log(text);
    console.log('--- OCR Extracted Text End ---');

    if (!text || text.trim().length === 0) return null;

    // 3. Pattern Matching for UTR / Ref No (Paytm, PhonePe, GPay, BHIM)
    
    // Pattern A: Match labeled Ref No / UTR e.g. "Ref. No: 625511029987" or "UPI Ref No 625511029987" or "UTR: 625511029987"
    const labelMatch = text.match(/(?:Ref\.?\s*No|UPI\s*Ref(?:\s*No)?|UTR|Txn\s*ID|Transaction\s*ID)[:\s.#]*([0-9]{10,18})/i);
    if (labelMatch && labelMatch[1]) {
      const extracted = labelMatch[1].trim();
      if (extracted.length >= 8 && extracted.length <= 22) {
        console.log(`✅ OCR Extracted Labeled UTR: ${extracted}`);
        return extracted;
      }
    }

    // Pattern B: Search for any standalone 12-digit numerical UTR (Standard Indian UPI Ref format)
    const twelveDigitMatches = text.match(/\b([0-9]{12})\b/g);
    if (twelveDigitMatches && twelveDigitMatches.length > 0) {
      // Find candidate that is not a standard phone number starting with +91 or common timestamp
      for (const candidate of twelveDigitMatches) {
        if (!candidate.startsWith('9198') && !candidate.startsWith('9199')) {
          console.log(`✅ OCR Extracted 12-Digit UTR: ${candidate}`);
          return candidate;
        }
      }
      console.log(`✅ OCR Extracted 12-Digit UTR: ${twelveDigitMatches[0]}`);
      return twelveDigitMatches[0];
    }

    return null;
  } catch (err) {
    console.error('Error extracting UTR via Tesseract OCR:', err.message || err);
    return null;
  }
};

module.exports = {
  extractUtrFromScreenshot,
};
