const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { sendEmail } = require('./mailService');

/**
 * Calculate and update a customer's risk level, credit score, and due prediction.
 * Credit Score range: 300 to 900 (like CIBIL score)
 * Due Prediction:
 * - 'trusted': Trusted Customer ✅
 * - 'delay': Late Payer ⚠️
 * - 'risky': Risky Customer 🚨
 */
const updateRiskLevel = async (customerId) => {
  try {
    const customer = await Customer.findById(customerId).populate('owner');
    if (!customer) return;
    
    const previousRiskLevel = customer.riskLevel;

    const transactions = await Transaction.find({ customer: customerId }).sort({ date: 1 });

    let score = 650; // Dynamic, realistic base score for starting customers
    let riskLevel = 'low';
    let duePrediction = 'trusted';

    const creditTxns = transactions.filter(t => t.type === 'credit');

    // 1. Promptness and Payment Speed Bonuses
    // For every settled transaction, check how long it took to settle (in days)
    let promptPayments = 0;
    let normalPayments = 0;
    let latePayments = 0;
    let veryLatePayments = 0;

    for (const txn of creditTxns) {
      if (txn.paymentStatus === 'SETTLED') {
        const settleTime = txn.updatedAt || txn.date;
        const daysDiff = Math.max(0, (new Date(settleTime) - new Date(txn.date)) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 3) {
          promptPayments++;
        } else if (daysDiff <= 10) {
          normalPayments++;
        } else if (daysDiff <= 25) {
          latePayments++;
        } else {
          veryLatePayments++;
        }
      } else {
        // Pending credit transaction: check how long it has been pending
        const daysPending = (Date.now() - new Date(txn.date)) / (1000 * 60 * 60 * 24);
        if (daysPending > 30) {
          veryLatePayments++;
        } else if (daysPending > 14) {
          latePayments++;
        }
      }
    }

    // Apply adjustments based on payment promptness categories
    score += (promptPayments * 35);
    score += (normalPayments * 15);
    score -= (latePayments * 40);
    score -= (veryLatePayments * 85);

    // 2. Outstanding Balance & Days Since Last Payment Penalties
    if (customer.balance > 0) {
      // Small balance has minimal penalty, high balances have higher penalties (credit utilization)
      if (customer.balance <= 1000) {
        score -= 10;
      } else if (customer.balance <= 5000) {
        score -= 40;
      } else if (customer.balance <= 10000) {
        score -= 85;
      } else {
        score -= 150;
      }

      // Check how long they have had an outstanding balance without paying anything back
      if (customer.lastPaymentDate) {
        const daysSincePayment = (Date.now() - new Date(customer.lastPaymentDate)) / (1000 * 60 * 60 * 24);
        if (daysSincePayment > 30) {
          score -= 100;
        } else if (daysSincePayment > 14) {
          score -= 40;
        }
      } else {
        // Outstanding balance and has never paid anything back
        const firstCredit = creditTxns[0];
        if (firstCredit) {
          const daysSinceFirstCredit = (Date.now() - new Date(firstCredit.date)) / (1000 * 60 * 60 * 24);
          if (daysSinceFirstCredit > 30) {
            score -= 100;
          } else if (daysSinceFirstCredit > 14) {
            score -= 40;
          }
        }
      }
    } else {
      // Clear account / advance balance bonus
      score += 25;
    }

    // 2.5 Overdue Payment Due Date Penalty
    if (customer.paymentDueDate && customer.balance > 0 && Date.now() > new Date(customer.paymentDueDate)) {
      const daysOverdue = Math.floor((Date.now() - new Date(customer.paymentDueDate)) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        score -= (daysOverdue * 15);
      }
    }

    // 3. Score Boundaries Check
    if (score > 900) score = 900;
    if (score < 300) score = 300;

    // 4. Determine status labels and risk level based on the computed score
    if (score >= 700) {
      duePrediction = 'trusted';
      riskLevel = 'low';
    } else if (score >= 550) {
      duePrediction = 'delay';
      riskLevel = 'medium';
    } else {
      duePrediction = 'risky';
      riskLevel = 'high';
    }

    // Update customer document
    customer.riskLevel = riskLevel;
    customer.creditScore = Math.round(score);
    customer.duePrediction = duePrediction;
    
    await customer.save();

    // Trigger email reminder if risk level increases (more risk than previous, or is medium/high and changed)
    if (customer.email && riskLevel !== 'low' && riskLevel !== previousRiskLevel) {
      try {
        const storeName = customer.owner?.storeName || 'Digital Udhaar';
        const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'Valued Customer';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        let riskText = `Namaste ${customerFirstName}!\n\n⚠️ IMPORTANT CREDIT ALERT: Your credit profile status at ${storeName} has changed.\n\nYour credit score is now ${customer.creditScore}/900 (Risk Level: ${riskLevel.toUpperCase()}).\n\nKindly clear your outstanding balance of ₹${customer.balance.toFixed(2)} to improve your credit standing.\n\n💳 Pay now: ${frontendUrl}/pay/${customer._id}`;
        
        let riskHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff; color: #18181b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #ef4444; font-weight: 800; margin: 0; font-size: 24px; letter-spacing: -0.025em;">${storeName}</h2>
              <p style="color: #ef4444; font-weight: bold; font-size: 14px; margin: 4px 0 0 0;">⚠️ CREDIT ACCOUNT STATUS UPDATE</p>
            </div>
            
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Namaste <strong>${customerFirstName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">This is an alert from <strong>Digital Udhaar</strong> regarding your credit standing. Your account profile status at <strong>${storeName}</strong> has been updated due to payment delays.</p>
            
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: left;">
              <span style="font-size: 13px; color: #991b1b; display: block; font-weight: bold;">🚨 Credit Standing Downgrade:</span>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px;">
                <span style="color: #7f1d1d;">New Credit Score: <strong style="font-size: 15px; color: #b91c1c;">${customer.creditScore} / 900</strong></span>
                <span style="color: #7f1d1d;">Risk Level: <strong style="color: #b91c1c; text-transform: uppercase;">${riskLevel}</strong></span>
              </div>
              <p style="font-size: 12px; color: #991b1b; margin: 8px 0 0 0;">Previous Risk Level: <strong style="text-transform: uppercase;">${previousRiskLevel || 'low'}</strong></p>
            </div>

            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
              <span style="font-size: 11px; color: #ef4444; display: block; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">Total Outstanding Dues</span>
              <span style="font-size: 36px; color: #b91c1c; font-weight: 900; font-family: system-ui, -apple-system, sans-serif;">₹${customer.balance.toFixed(2)}</span>
            </div>
            
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="${frontendUrl}/pay/${customer._id}" 
                 style="background-color: #ef4444; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                 Pay Now
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #fca5a5; margin: 32px 0 24px 0;" />
            <p style="font-size: 11px; color: #f87171; text-align: center; margin: 0;">This is an automated credit alert sent by Digital Udhaar.</p>
          </div>
        `;

        await sendEmail({
          to: customer.email,
          subject: `[CREDIT ALERT] Account Risk Status Update at ${storeName}`,
          text: riskText,
          html: riskHtml
        });
        console.log(`✉️ Sent risk level alert email to ${customer.name} (${customer.email})`);
      } catch (emailErr) {
        console.error('Error sending risk level alert email:', emailErr.message);
      }
    }

    return {
      riskLevel: customer.riskLevel,
      creditScore: customer.creditScore,
      duePrediction: customer.duePrediction
    };
  } catch (error) {
    console.error('Risk calculation error:', error.message);
  }
};

module.exports = { updateRiskLevel };
