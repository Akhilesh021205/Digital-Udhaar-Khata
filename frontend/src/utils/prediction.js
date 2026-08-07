/**
 * Generates deterministic, realistic dummy credit scores and risk predictions
 * based on a customer's ID/name. This ensures user privacy, consistency on reload,
 * and a realistic, premium UI demonstration.
 */
export const getDeterministicPrediction = (customerId, name = '') => {
  const seed = customerId || name || 'default';
  
  // Simple hash function (djb2) to generate a stable numeric hash
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
  }
  hash = Math.abs(hash);

  // Generate a realistic credit score distribution between 580 and 840 (CIBIL-like range)
  const creditScore = 580 + (hash % 261);
  
  let duePrediction = 'trusted';
  let riskLevel = 'low';
  
  if (creditScore >= 720) {
    duePrediction = 'trusted';
    riskLevel = 'low';
  } else if (creditScore >= 620) {
    duePrediction = 'delay';
    riskLevel = 'medium';
  } else {
    duePrediction = 'risky';
    riskLevel = 'high';
  }
  
  return { creditScore, duePrediction, riskLevel };
};
