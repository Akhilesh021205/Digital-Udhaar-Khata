const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { sendEmail } = require('../services/mailService');
const { generateStatementBuffer } = require('../services/pdfService');

const buildPaymentReminderHTML = ({ storeName, customerFirstName, customerName, balance, upiId, customerId }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:36px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- TOP GRADIENT BAR -->
        <tr><td style="background:linear-gradient(90deg, #f97316 0%, #ea580c 100%);height:6px;border-radius:12px 12px 0 0;"></td></tr>

        <!-- MAIN CARD -->
        <tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:36px 40px;box-shadow:0 4px 20px rgba(0,0,0,0.03);">

          <!-- HEADER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td>
                <span style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#f97316;">PAYMENT REMINDER</span>
                <h1 style="margin:6px 0 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">${storeName}</h1>
                <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">AI Digital Khata &nbsp;&bull;&nbsp; Outstanding Dues Notice</p>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;">&#9679; Secure</span>
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <div style="height:1px;background-color:#f1f5f9;margin-bottom:24px;"></div>

          <!-- GREETING -->
          <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 6px 0;">Namaste <strong style="color:#0f172a;">${customerFirstName}</strong>,</p>
          <p style="font-size:14px;line-height:1.7;color:#64748b;margin:0 0 24px 0;">You have an outstanding balance at <strong style="color:#0f172a;">${storeName}</strong>. Please review the details below and make a payment at your earliest convenience.</p>

          <!-- AMOUNT CARD -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px;padding:32px 24px;text-align:center;box-shadow:0 10px 25px -5px rgba(15,23,42,0.15);">
                <p style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">TOTAL OUTSTANDING DUE</p>
                <p style="margin:0 0 14px 0;font-size:48px;font-weight:700;color:#ffffff;letter-spacing:-0.03em;">&#8377;${balance.toFixed(2)}</p>
                <span style="display:inline-block;background-color:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:11px;font-weight:800;padding:5px 16px;border-radius:999px;letter-spacing:0.04em;">OVERDUE &bull; ACTION REQUIRED</span>
              </td>
            </tr>
          </table>

          <!-- PAYMENT DETAILS ROW -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <table width="100%"><tr>
                  <td style="font-size:13px;color:#64748b;font-weight:600;">Customer Name</td>
                  <td align="right" style="font-size:14px;color:#0f172a;font-weight:700;">${customerName}</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;${upiId ? 'border-bottom:1px solid #f1f5f9;' : ''}">
                <table width="100%"><tr>
                  <td style="font-size:13px;color:#64748b;font-weight:600;">Outstanding Amount</td>
                  <td align="right" style="font-size:14px;color:#ef4444;font-weight:700;">&#8377;${balance.toFixed(2)}</td>
                </tr></table>
              </td>
            </tr>
            ${upiId ? `
            <tr>
              <td style="padding:10px 0;">
                <table width="100%"><tr>
                  <td style="font-size:13px;color:#64748b;font-weight:600;">Pay to UPI ID</td>
                  <td align="right" style="font-size:14px;color:#2563eb;font-weight:700;font-family:monospace;">${upiId}</td>
                </tr></table>
              </td>
            </tr>` : ''}
          </table>

          <!-- CTA BUTTON (ALWAYS SHOWN) -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td align="center">
                <a href="${frontendUrl}/pay/${customerId}" style="display:inline-block;background:linear-gradient(135deg, #f97316 0%, #ea580c 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 44px;border-radius:12px;letter-spacing:0.01em;box-shadow:0 6px 20px rgba(249,115,22,0.35);">Pay &#8377;${balance.toFixed(2)} Now &rarr;</a>
              </td>
            </tr>
          </table>

          <!-- SUPPORTED APPS WITH REAL BRAND ICONS -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td align="center" style="font-size:12px;color:#64748b;font-weight:600;padding-bottom:10px;">Accepted Payment Methods:</td>
            </tr>
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding:0 6px;">
                      <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;">
                        <tr>
                          <td valign="middle"><img src="https://img.icons8.com/color/48/phone-pe.png" width="18" height="18" alt="PhonePe" style="display:block;border:0;"/></td>
                          <td valign="middle" style="font-size:12px;font-weight:700;color:#1e293b;padding-left:6px;font-family:sans-serif;">PhonePe</td>
                        </tr>
                      </table>
                    </td>
                    <td align="center" style="padding:0 6px;">
                      <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;">
                        <tr>
                          <td valign="middle"><img src="https://img.icons8.com/color/48/google-pay.png" width="18" height="18" alt="Google Pay" style="display:block;border:0;"/></td>
                          <td valign="middle" style="font-size:12px;font-weight:700;color:#1e293b;padding-left:6px;font-family:sans-serif;">GPay</td>
                        </tr>
                      </table>
                    </td>
                    <td align="center" style="padding:0 6px;">
                      <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;">
                        <tr>
                          <td valign="middle"><img src="https://img.icons8.com/color/48/paytm.png" width="18" height="18" alt="Paytm" style="display:block;border:0;"/></td>
                          <td valign="middle" style="font-size:12px;font-weight:700;color:#1e293b;padding-left:6px;font-family:sans-serif;">Paytm</td>
                        </tr>
                      </table>
                    </td>
                    <td align="center" style="padding:0 6px;">
                      <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;">
                        <tr>
                          <td valign="middle"><img src="https://img.icons8.com/color/48/bhim.png" width="18" height="18" alt="BHIM UPI" style="display:block;border:0;"/></td>
                          <td valign="middle" style="font-size:12px;font-weight:700;color:#1e293b;padding-left:6px;font-family:sans-serif;">BHIM UPI</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- SECURE NOTE -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
            <tr>
              <td width="26" valign="middle" style="padding-right:10px;">
                <img src="https://img.icons8.com/color/48/shield-checked.png" width="22" height="22" alt="Secure" style="display:block;border:0;"/>
              </td>
              <td valign="middle" style="font-size:13px;color:#166534;font-weight:600;line-height:1.5;">
                This is a secure payment link. You can view your bill statement and clear dues directly for <strong>${storeName}</strong>.
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <div style="height:1px;background-color:#f1f5f9;margin-bottom:24px;"></div>

          <!-- FOOTER -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#64748b;">
                <strong style="color:#0f172a;">${storeName}</strong><br/>
                Powered by <span style="color:#f97316;font-weight:700;">AI Digital Khata</span>
              </td>
              <td align="right" style="font-size:12px;color:#64748b;line-height:1.5;">
                This is an AI generated message. Please contact admin if you have any questions.
              </td>
            </tr>
          </table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const buildStatementEmailHTML = ({ storeName, customerFirstName, customerName, balance, dateRange }) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:36px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- TOP BLUE GRADIENT BAR -->
        <tr><td style="background:linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);height:6px;border-radius:12px 12px 0 0;"></td></tr>

        <!-- MAIN CARD -->
        <tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:36px 40px;box-shadow:0 4px 20px rgba(0,0,0,0.03);">

          <!-- HEADER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td>
                <span style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#2563eb;">ACCOUNT STATEMENT BILL</span>
                <h1 style="margin:6px 0 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">${storeName}</h1>
                <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">AI Digital Khata &nbsp;&bull;&nbsp; Monthly Ledger Report</p>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background-color:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;">📄 PDF Attached</span>
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <div style="height:1px;background-color:#f1f5f9;margin-bottom:24px;"></div>

          <!-- GREETING -->
          <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 6px 0;">Namaste <strong style="color:#0f172a;">${customerFirstName}</strong>,</p>
          <p style="font-size:14px;line-height:1.7;color:#64748b;margin:0 0 24px 0;">Please find attached your detailed Account Statement for <strong style="color:#0f172a;">${storeName}</strong> covering period <strong style="color:#0f172a;">${dateRange.startDate} - ${dateRange.endDate}</strong>.</p>

          <!-- SUMMARY CARD -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;">
            <tr>
              <td style="padding-bottom:12px;border-bottom:1px solid #f1f5f9;">
                <table width="100%"><tr>
                  <td style="font-size:13px;color:#64748b;font-weight:600;">Customer Name</td>
                  <td align="right" style="font-size:14px;color:#0f172a;font-weight:700;">${customerName}</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;">
                <table width="100%"><tr>
                  <td style="font-size:13px;color:#64748b;font-weight:600;">Current Statement Balance</td>
                  <td align="right" style="font-size:16px;color:#ef4444;font-weight:800;">&#8377;${balance.toFixed(2)}</td>
                </tr></table>
              </td>
            </tr>
          </table>

          <!-- PDF INFO BANNER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
            <tr>
              <td width="28" valign="middle" style="padding-right:12px;">
                <img src="https://img.icons8.com/color/48/pdf.png" width="24" height="24" alt="PDF" style="display:block;border:0;"/>
              </td>
              <td valign="middle" style="font-size:13px;color:#1e40af;font-weight:600;line-height:1.5;">
                Your complete itemized ledger transactions PDF has been attached to this email. You can download or print it for your records.
              </td>
            </tr>
          </table>

          <!-- DIVIDER -->
          <div style="height:1px;background-color:#f1f5f9;margin-bottom:24px;"></div>

          <!-- FOOTER -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#64748b;">
                <strong style="color:#0f172a;">${storeName}</strong><br/>
                Powered by <span style="color:#2563eb;font-weight:700;">AI Digital Khata</span>
              </td>
              <td align="right" style="font-size:12px;color:#64748b;line-height:1.5;">
                This is an AI generated statement notice. Please contact admin if you have questions.
              </td>
            </tr>
          </table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// Core reminder execution logic (can be called by controller routes or AI voice controller)
const executeReminderSend = async (customer, user) => {
  if (customer.balance <= 0) {
    throw new Error(`Customer ${customer.name} has no outstanding balance to send a reminder.`);
  }

  if (!customer.email) {
    throw new Error(`Customer ${customer.name} does not have an email address configured. Please edit and add an email address first.`);
  }

  const storeName = user.storeName || 'AI Digital Khata';
  const upiId = user.upiId;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'Valued Customer';

  // 1. PAYMENT BILL EMAIL (Dedicated Payment Link & Dues Notice)
  const paymentTextMessage = `Namaste ${customerFirstName}!\n\nThis is your payment bill and due notice from ${storeName}.\n\nTotal Outstanding Due: ₹${customer.balance.toFixed(2)}.\n\n💳 Pay now: ${frontendUrl}/pay/${customer._id}\n\nThank you! 🙏`;
  const paymentHtmlMessage = buildPaymentReminderHTML({
    storeName,
    customerFirstName,
    customerName: customer.name,
    balance: customer.balance,
    upiId,
    customerId: customer._id
  });

  const paymentEmailPromise = sendEmail({
    to: customer.email,
    subject: `💳 Payment Bill & Due Notice - ${storeName}`,
    text: paymentTextMessage,
    html: paymentHtmlMessage,
  });

  // 2. STATEMENT BILL EMAIL (Dedicated Monthly PDF Ledger Statement)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const transactions = await Transaction.find({
    customer: customer._id,
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 });

  const store = {
    storeName,
    name: user.name,
    phone: user.phone,
    upiId: user.upiId || '',
  };
  const dateRange = {
    startDate: start.toLocaleDateString('en-IN'),
    endDate: end.toLocaleDateString('en-IN'),
  };

  const pdfBuffer = await generateStatementBuffer(store, customer, transactions, dateRange);

  const statementTextMessage = `Namaste ${customerFirstName}!\n\nYour monthly statement of account for ${storeName} is attached to this email as a PDF.\n\nCurrent Statement Balance: ₹${customer.balance.toFixed(2)}\nStatement Period: ${dateRange.startDate} - ${dateRange.endDate}\n\nThank you! 🙏`;
  const statementHtmlMessage = buildStatementEmailHTML({
    storeName,
    customerFirstName,
    customerName: customer.name,
    balance: customer.balance,
    dateRange
  });

  const statementEmailPromise = sendEmail({
    to: customer.email,
    subject: `📄 Monthly Account Statement - ${storeName}`,
    text: statementTextMessage,
    html: statementHtmlMessage,
    attachments: [
      {
        filename: `statement_${customer.name.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
      }
    ]
  });

  // Send both emails separately so Gmail does NOT thread them into one chat
  const [paymentResult, statementResult] = await Promise.all([paymentEmailPromise, statementEmailPromise]);

  return { paymentResult, statementResult };
};

// @desc    Send payment reminder to a customer via Email
// @route   POST /api/reminders/send/:customerId
const sendReminder = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      owner: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const result = await executeReminderSend(customer, req.user);

    res.status(200).json({
      success: true,
      message: `Email reminder sent to ${customer.name} at ${customer.email}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send bulk reminders to all customers with balance > 0 via Email
// @route   POST /api/reminders/send-bulk
const sendBulkReminders = async (req, res, next) => {
  try {
    const customers = await Customer.find({
      owner: req.user._id,
      balance: { $gt: 0 },
      email: { $gt: '' },
    });

    if (customers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No customers with outstanding balance and email addresses configured',
        data: { sent: 0, failed: 0 },
      });
    }

    const storeName = req.user.storeName || 'AI Digital Khata';
    const upiId = req.user.upiId;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const customer of customers) {
      try {
        const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'Valued Customer';

        // 1. PAYMENT BILL EMAIL
        const paymentTextMessage = `Namaste ${customerFirstName}!\n\nThis is your payment bill and due notice from ${storeName}.\n\nTotal Outstanding Due: ₹${customer.balance.toFixed(2)}.\n\n💳 Pay now: ${frontendUrl}/pay/${customer._id}\n\nThank you! 🙏`;
        const paymentHtmlMessage = buildPaymentReminderHTML({
          storeName,
          customerFirstName,
          customerName: customer.name,
          balance: customer.balance,
          upiId,
          customerId: customer._id
        });

        const paymentPromise = sendEmail({
          to: customer.email,
          subject: `💳 Payment Bill & Due Notice - ${storeName}`,
          text: paymentTextMessage,
          html: paymentHtmlMessage,
        });

        // 2. STATEMENT BILL EMAIL
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const transactions = await Transaction.find({
          customer: customer._id,
          date: { $gte: start, $lte: end },
        }).sort({ date: 1 });

        const store = {
          storeName,
          name: req.user.name,
          phone: req.user.phone,
          upiId: req.user.upiId || '',
        };
        const dateRange = {
          startDate: start.toLocaleDateString('en-IN'),
          endDate: end.toLocaleDateString('en-IN'),
        };

        const pdfBuffer = await generateStatementBuffer(store, customer, transactions, dateRange);

        const statementTextMessage = `Namaste ${customerFirstName}!\n\nYour monthly statement of account for ${storeName} is attached to this email as a PDF.\n\nCurrent Statement Balance: ₹${customer.balance.toFixed(2)}\nStatement Period: ${dateRange.startDate} - ${dateRange.endDate}\n\nThank you! 🙏`;
        const statementHtmlMessage = buildStatementEmailHTML({
          storeName,
          customerFirstName,
          customerName: customer.name,
          balance: customer.balance,
          dateRange
        });

        const statementPromise = sendEmail({
          to: customer.email,
          subject: `📄 Monthly Account Statement - ${storeName}`,
          text: statementTextMessage,
          html: statementHtmlMessage,
          attachments: [
            {
              filename: `statement_${customer.name.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
            }
          ]
        });

        await Promise.all([paymentPromise, statementPromise]);

        sent++;
        results.push({ customer: customer.name, status: 'sent', email: customer.email });
      } catch (err) {
        failed++;
        results.push({ customer: customer.name, status: 'failed', error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Email reminders sent: ${sent}, Failed: ${failed}`,
      data: { sent, failed, results },
    });
  } catch (error) {
    next(error);
  }
};

// Backwards-compatible SMS wrapper redirecting to Email
const sendFast2SMSSMS = async (req, res, next) => {
  try {
    req.params.customerId = req.body.customerId;
    return await sendReminder(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Backwards-compatible WhatsApp wrapper redirecting to Email
const sendCloudWhatsApp = async (req, res, next) => {
  try {
    req.params.customerId = req.body.customerId;
    return await sendReminder(req, res, next);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  executeReminderSend,
  sendReminder,
  sendBulkReminders,
  sendFast2SMSSMS,
  sendCloudWhatsApp,
};
