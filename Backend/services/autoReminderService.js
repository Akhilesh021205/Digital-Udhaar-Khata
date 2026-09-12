const Customer = require('../models/Customer');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendEmail } = require('./mailService');
const { generateStatementBuffer } = require('./pdfService');
const { updateRiskLevel } = require('./riskService');

/**
 * Calculates differences in days (date2 - date1) based on calendar dates (ignoring time)
 */
const getDaysDiff = (date1, date2) => {
  const d1 = new Date(date1);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Automatically checks and sends payment reminders to customers.
 * - From 4 days before the due date (inclusive): sends pre-due warning reminders daily if unpaid.
 * - After the due date: deducts credit score dynamically and sends continuous daily overdue warnings if unpaid.
 */
const runAutoReminders = async () => {
  console.log('🤖 KathaGPT Auto-Reminder Bot: Checking for outstanding dues today...');
  try {
    const today = new Date();
    const todayStr = today.toDateString();
    
    // Find all customers with:
    // 1. Dues (balance > 0)
    // 2. paymentDueDate set
    const customers = await Customer.find({
      balance: { $gt: 0 },
      paymentDueDate: { $ne: null }
    }).populate('owner');

    console.log(`🤖 KathaGPT Auto-Reminder Bot: Found ${customers.length} customer(s) with active outstanding balances and due dates.`);

    for (const customer of customers) {
      if (!customer.owner) continue;

      // Skip if already processed today
      if (customer.lastAutoReminderSentDate && new Date(customer.lastAutoReminderSentDate).toDateString() === todayStr) {
        continue;
      }

      const owner = customer.owner;
      const storeName = owner.storeName || 'AI Digital Khata';
      const upiId = owner.upiId;
      const dueDate = new Date(customer.paymentDueDate);
      const daysDiff = getDaysDiff(today, dueDate);

      // Check if it's within the reminder windows:
      // Warning window: 0 to 4 days before due date (daysDiff from 0 to 4)
      // Overdue window: after due date (daysDiff < 0)
      const isWarningPeriod = daysDiff >= 0 && daysDiff <= 4;
      const isOverduePeriod = daysDiff < 0;

      if (!isWarningPeriod && !isOverduePeriod) {
        // Too early, do nothing
        continue;
      }

      // If overdue, update risk level and apply score penalty
      if (isOverduePeriod) {
        console.log(`⚠️ Customer ${customer.name} is overdue by ${Math.abs(daysDiff)} day(s). Recalculating score penalty.`);
        await updateRiskLevel(customer._id);
        // Refresh customer data from database after score deduction
        const refreshedCustomer = await Customer.findById(customer._id).populate('owner');
        if (refreshedCustomer) {
          Object.assign(customer, refreshedCustomer.toObject());
        }
      }

      // Check if customer has a valid email address to send the reminder
      if (!customer.email || customer.email.trim() === '') {
        // No email set, but we still update the last processed date so we don't repeat the check today
        customer.lastAutoReminderSentDate = today;
        await customer.save();
        continue;
      }

      console.log(`🤖 KathaGPT Auto-Reminder Bot: Sending email to ${customer.name} (${customer.email}) for store ${storeName}`);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'Valued Customer';
      
      let textMessage = '';
      let htmlMessage = '';

      if (isWarningPeriod) {
        const daysLeftText = daysDiff === 0 ? 'today' : `in ${daysDiff} days`;
        textMessage = `Namaste ${customerFirstName}!\n\nThis is an automated payment reminder from AI Digital Khata.\n\nYour outstanding balance of ₹${customer.balance.toFixed(2)} at ${storeName} is due ${daysLeftText} on ${dueDate.toLocaleDateString('en-IN')}.\n\nKindly clear your dues at your earliest convenience to maintain a healthy credit score. Your transaction statement is attached as a PDF. Thank you! 🙏\n\n💳 Pay now: ${frontendUrl}/pay/${customer._id}`;

        htmlMessage = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff; color: #18181b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #f97316; font-weight: 800; margin: 0; font-size: 24px; letter-spacing: -0.025em;">${storeName}</h2>
              <p style="color: #71717a; font-size: 14px; margin: 4px 0 0 0;">AI Digital Khata Automatic Payment Reminder</p>
            </div>
            
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Namaste <strong>${customerFirstName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">This is an automated reminder from <strong>AI Digital Khata</strong>. Your outstanding balance of <strong>₹${customer.balance.toFixed(2)}</strong> is due <strong>${daysLeftText}</strong> on <strong>${dueDate.toLocaleDateString('en-IN')}</strong>.</p>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Please clear your payment soon to keep your credit profile in excellent standing.</p>
            
            <div style="background-color: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
              <span style="font-size: 11px; color: #ea580c; display: block; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">Amount Due ${daysLeftText}</span>
              <span style="font-size: 36px; color: #c2410c; font-weight: 900; font-family: system-ui, -apple-system, sans-serif;">₹${customer.balance.toFixed(2)}</span>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 20px; border-radius: 8px; margin: 16px 0; text-align: left;">
              <span style="font-size: 13px; color: #475569; display: block; font-weight: 600;">Current Credit Profile:</span>
              <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 13px;">
                <span style="color: #64748b;">Credit Score: <strong>${customer.creditScore || 750} / 900</strong></span>
                <span style="color: #64748b;">Risk Status: <strong style="color: ${customer.riskLevel === 'high' ? '#ef4444' : customer.riskLevel === 'medium' ? '#f59e0b' : '#10b981'}; text-transform: uppercase;">${customer.riskLevel}</strong></span>
              </div>
            </div>
            
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="${frontendUrl}/pay/${customer._id}" 
                 style="background-color: #f97316; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2);">
                 Pay Now
              </a>
              ${upiId ? `<p style="font-size: 11px; color: #71717a; margin-top: 10px;">UPI ID: <strong>${upiId}</strong></p>` : ''}
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0 24px 0;" />
            <p style="font-size: 11px; color: #a1a1aa; text-align: center; margin: 0;">This is an AI generated message. Please contact admin if you have any questions.</p>
          </div>
        `;
      } else if (isOverduePeriod) {
        const daysOverdue = Math.abs(daysDiff);
        textMessage = `Namaste ${customerFirstName}!\n\n⚠️ IMPORTANT: Your payment is OVERDUE by ${daysOverdue} day(s) at ${storeName}.\n\nYour outstanding balance of ₹${customer.balance.toFixed(2)} was due on ${dueDate.toLocaleDateString('en-IN')}.\n\nDue to this delay, your credit score has been decreased by ${daysOverdue * 15} points and is now ${customer.creditScore} (Risk Level: ${customer.riskLevel.toUpperCase()}).\n\nKindly pay immediately to prevent further penalty. Your transaction statement is attached as a PDF. Thank you.\n\n💳 Pay now: ${frontendUrl}/pay/${customer._id}`;

        htmlMessage = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff; color: #18181b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #ef4444; font-weight: 800; margin: 0; font-size: 24px; letter-spacing: -0.025em;">${storeName}</h2>
              <p style="color: #ef4444; font-weight: bold; font-size: 14px; margin: 4px 0 0 0;">⚠️ OVERDUE PAYMENT WARNING</p>
            </div>
            
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">Namaste <strong>${customerFirstName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">This is an urgent notification from <strong>AI Digital Khata</strong>. Your outstanding balance of <strong>₹${customer.balance.toFixed(2)}</strong> is now <strong>OVERDUE by ${daysOverdue} day(s)</strong> (Scheduled due date: ${dueDate.toLocaleDateString('en-IN')}).</p>
            
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
              <span style="font-size: 11px; color: #ef4444; display: block; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">Total Overdue Amount</span>
              <span style="font-size: 36px; color: #b91c1c; font-weight: 900; font-family: system-ui, -apple-system, sans-serif;">₹${customer.balance.toFixed(2)}</span>
            </div>

            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: left;">
              <span style="font-size: 13px; color: #991b1b; display: block; font-weight: bold;">🚨 Credit Score Penalty Applied:</span>
              <p style="font-size: 13px; color: #7f1d1d; margin: 4px 0 8px 0;">Due to non-payment by the scheduled date, your credit rating has been downgraded:</p>
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: #7f1d1d;">New Credit Score: <strong style="font-size: 15px; color: #b91c1c;">${customer.creditScore || 300} / 900</strong></span>
                <span style="color: #7f1d1d;">Risk Level: <strong style="color: #b91c1c; text-transform: uppercase;">${customer.riskLevel}</strong></span>
              </div>
            </div>
            
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="${frontendUrl}/pay/${customer._id}" 
                 style="background-color: #ef4444; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                 Pay Immediately
              </a>
              ${upiId ? `<p style="font-size: 11px; color: #71717a; margin-top: 10px;">UPI ID: <strong>${upiId}</strong></p>` : ''}
            </div>
            
            <hr style="border: 0; border-top: 1px solid #fca5a5; margin: 32px 0 24px 0;" />
            <p style="font-size: 11px; color: #f87171; text-align: center; margin: 0;">This is an AI generated message. Please contact admin if you have any questions.</p>
          </div>
        `;
      }

      // Fetch transactions for PDF statement
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const transactions = await Transaction.find({
        customer: customer._id,
        date: { $gte: start, $lte: end },
      }).sort({ date: 1 });

      const store = {
        storeName,
        name: owner.name,
        phone: owner.phone,
      };
      const dateRange = {
        startDate: start.toLocaleDateString('en-IN'),
        endDate: end.toLocaleDateString('en-IN'),
      };

      try {
        const pdfBuffer = await generateStatementBuffer(store, customer, transactions, dateRange);

        // 1. PAYMENT BILL EMAIL
        const paymentSubject = isOverduePeriod 
          ? `💳 [OVERDUE PAYMENT BILL] Action Required - ${storeName}` 
          : `💳 Payment Bill & Due Notice - ${storeName}`;

        const paymentEmailPromise = sendEmail({
          to: customer.email,
          subject: paymentSubject,
          text: textMessage,
          html: htmlMessage,
        });

        // 2. STATEMENT BILL EMAIL
        const statementSubject = `📄 Monthly Account Statement - ${storeName}`;
        const statementText = `Namaste ${customerFirstName}!\n\nYour monthly statement of account for ${storeName} is attached to this email as a PDF.\n\nCurrent Statement Balance: ₹${customer.balance.toFixed(2)}\nStatement Period: ${dateRange.startDate} - ${dateRange.endDate}\n\nThank you! 🙏`;
        const statementHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #18181b;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #2563eb; font-weight: 800; margin: 0; font-size: 24px;">${storeName}</h2>
              <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Monthly Account Statement Report</p>
            </div>
            <p style="font-size: 15px; color: #334155;">Namaste <strong>${customerFirstName}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">Please find attached your official monthly account statement PDF for period <strong>${dateRange.startDate} - ${dateRange.endDate}</strong>.</p>
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <span style="font-size: 12px; color: #1e40af; font-weight: bold; display: block; uppercase;">Statement Balance Due</span>
              <span style="font-size: 32px; color: #1e3a8a; font-weight: 900;">₹${customer.balance.toFixed(2)}</span>
            </div>
            <p style="font-size: 13px; color: #64748b;">The complete itemized ledger PDF file is attached below for your record.</p>
          </div>
        `;

        const statementEmailPromise = sendEmail({
          to: customer.email,
          subject: statementSubject,
          text: statementText,
          html: statementHtml,
          attachments: [
            {
              filename: `statement_${customer.name.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
            }
          ]
        });

        await Promise.all([paymentEmailPromise, statementEmailPromise]);

        // Set last reminder sent to today
        customer.lastAutoReminderSentDate = today;
        await customer.save();

        console.log(`🤖 KathaGPT Auto-Reminder Bot: Sent payment bill & statement bill separately. Days diff: ${daysDiff}`);
      } catch (err) {
        console.error(`❌ KathaGPT Auto-Reminder Bot: Error sending email to ${customer.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ KathaGPT Auto-Reminder Bot: Cron Job execution failed:', err.message);
  }
};

/**
 * Initializes the AI Auto-Reminder Bot Scheduler.
 */
const initAutoReminderScheduler = () => {
  // Run checks on startup (delayed slightly to ensure DB connection is ready)
  setTimeout(runAutoReminders, 10000);

  // Run checks every 24 hours
  setInterval(runAutoReminders, 24 * 60 * 60 * 1000);
  
  console.log('🤖 AI Auto-Reminder Bot: Scheduler initialized (runs every 24 hours).');
};

module.exports = { initAutoReminderScheduler };
