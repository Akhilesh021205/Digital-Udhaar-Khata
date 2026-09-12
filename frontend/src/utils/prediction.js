/**
 * Calculates customer credit score and risk prediction.
 * If customer has no transactions or balance <= 0, defaults to 'trusted' (clean record).
 * If customer has overdue balance or bad payment history, flags as 'delay' or 'risky'.
 */
export const getDeterministicPrediction = (customerOrId, name = '') => {
  let customer = {};
  if (typeof customerOrId === 'object' && customerOrId !== null) {
    customer = customerOrId;
  } else {
    customer = { _id: customerOrId, name };
  }

  const balance = typeof customer.balance === 'number' ? customer.balance : 0;
  const totalTxns = typeof customer.totalTransactions === 'number' ? customer.totalTransactions : 0;
  const paymentDueDate = customer.paymentDueDate;

  // 1. If customer has no transactions or zero/negative balance -> Always Trusted!
  if (totalTxns === 0 || balance <= 0) {
    return {
      creditScore: 800,
      duePrediction: 'trusted',
      riskLevel: 'low'
    };
  }

  // 2. Check if payment due date has passed
  let isOverdue = false;
  if (paymentDueDate) {
    const due = new Date(paymentDueDate);
    if (due < new Date()) {
      isOverdue = true;
    }
  }

  if (isOverdue) {
    return {
      creditScore: 590,
      duePrediction: 'risky',
      riskLevel: 'high'
    };
  }

  // 3. Balance tier evaluation
  if (balance <= 3000) {
    return {
      creditScore: 780,
      duePrediction: 'trusted',
      riskLevel: 'low'
    };
  } else if (balance <= 10000) {
    return {
      creditScore: 670,
      duePrediction: 'delay',
      riskLevel: 'medium'
    };
  } else {
    return {
      creditScore: 610,
      duePrediction: 'risky',
      riskLevel: 'high'
    };
  }
};
