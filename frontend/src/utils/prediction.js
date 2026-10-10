/**
 * Calculates customer credit score and risk prediction.
 * - New customer with 0 transactions -> 'new'
 * - Customer with cleared balance (balance === 0, transactions > 0) -> 'cleared'
 * - Customer taking khata with on-time record -> 'trusted'
 * - Customer with overdue balance -> 'delay' or 'risky'
 */
export const getDeterministicPrediction = (customerOrId, name = '') => {
  let customer = {};
  if (typeof customerOrId === 'object' && customerOrId !== null) {
    customer = customerOrId;
  } else {
    customer = { _id: customerOrId, name };
  }

  const balance = typeof customer.balance === 'number' ? customer.balance : 0;
  const totalTxns = typeof customer.totalTransactions === 'number' 
    ? customer.totalTransactions 
    : (Array.isArray(customer.transactions) ? customer.transactions.length : 0);
  const paymentDueDate = customer.paymentDueDate;

  // 1. Brand new customer with 0 transactions
  if (totalTxns === 0) {
    return {
      creditScore: 750,
      duePrediction: 'new',
      riskLevel: 'low'
    };
  }

  // 2. Customer had khata and cleared all dues!
  if (balance === 0) {
    return {
      creditScore: 850,
      duePrediction: 'cleared',
      riskLevel: 'low'
    };
  }

  // 3. Advance balance
  if (balance < 0) {
    return {
      creditScore: 820,
      duePrediction: 'trusted',
      riskLevel: 'low'
    };
  }

  // 4. Active balance > 0: Check if payment due date has passed
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

  // 5. Active khata balance tier evaluation
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

/**
 * Returns formatted badge labels, badge colors, and left accent borders
 * to ensure clear visual distinction between New, Cleared, and Active Trusted customers.
 */
export const getCustomerBadges = (customer = {}) => {
  const balance = typeof customer.balance === 'number' ? customer.balance : 0;
  const totalTxns = typeof customer.totalTransactions === 'number'
    ? customer.totalTransactions
    : (Array.isArray(customer.transactions) ? customer.transactions.length : 0);
  
  const rawPrediction = customer.duePrediction;
  const hasHistory = totalTxns > 0 || rawPrediction === 'cleared' || rawPrediction === 'delay' || rawPrediction === 'risky';

  // 1. Balance Status Pill (Top Right)
  let balanceTypeLabel = "NO DUES";
  let balanceTypeClass = "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40";
  let leftBorder = "border-l-4 border-l-blue-400";

  if (balance > 0) {
    balanceTypeLabel = "YOU'LL RECEIVE";
    balanceTypeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40";
    leftBorder = "border-l-4 border-l-emerald-500";
  } else if (balance < 0) {
    balanceTypeLabel = "YOU'LL PAY";
    balanceTypeClass = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40";
    leftBorder = "border-l-4 border-l-purple-500";
  } else {
    // balance === 0
    if (hasHistory) {
      balanceTypeLabel = "SETTLED";
      balanceTypeClass = "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40";
      leftBorder = "border-l-4 border-l-teal-500";
    } else {
      balanceTypeLabel = "NO DUES";
      balanceTypeClass = "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40";
      leftBorder = "border-l-4 border-l-blue-400";
    }
  }

  // 2. Reputation / Status Badge (Bottom Left)
  let statusLabel = "NEW";
  let statusDotColor = "bg-blue-500";
  let statusClass = "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400";

  if (balance === 0) {
    if (hasHistory) {
      // Customer had taken khata and cleared it
      statusLabel = "CLEARED";
      statusDotColor = "bg-teal-500";
      statusClass = "bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-400";
    } else {
      // New customer added with 0 due, has not started taking khata
      statusLabel = "NEW";
      statusDotColor = "bg-blue-500";
      statusClass = "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400";
    }
  } else if (balance < 0) {
    statusLabel = "ADVANCE";
    statusDotColor = "bg-purple-500";
    statusClass = "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400";
  } else {
    // balance > 0 (Active khata)
    if (rawPrediction === 'delay') {
      statusLabel = "DELAY";
      statusDotColor = "bg-amber-500";
      statusClass = "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400";
    } else if (rawPrediction === 'risky') {
      statusLabel = "RISKY";
      statusDotColor = "bg-rose-500";
      statusClass = "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400";
    } else {
      // Customer taking khata with on-time repayment history
      statusLabel = "TRUSTED";
      statusDotColor = "bg-emerald-500";
      statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400";
    }
  }

  return {
    balanceTypeLabel,
    balanceTypeClass,
    statusLabel,
    statusDotColor,
    statusClass,
    leftBorder
  };
};
