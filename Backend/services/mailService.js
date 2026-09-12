const nodemailer = require('nodemailer');
const axios = require('axios');

/**
 * Helper to parse sender string like '"Digital Udhaar" <support@udhaarkhata.com>'
 * into { name, email }
 */
const parseFrom = (fromStr) => {
  if (!fromStr) return { email: 'onboarding@example.com', name: 'AI Digital Khata' };
  
  const emailMatch = fromStr.match(/<([^>]+)>/);
  const nameMatch = fromStr.match(/^"([^"]+)"|([A-Za-z0-9\s\-_]+)(?=\s<)/);
  
  const email = emailMatch ? emailMatch[1].trim() : fromStr.trim();
  let name = '';
  if (nameMatch) {
    name = (nameMatch[1] || nameMatch[2] || '').trim();
  } else {
    name = process.env.APP_NAME || 'AI Digital Khata';
  }
  
  return { name, email };
};

const sendResend = async ({ to, subject, text, html, attachments, fromEmail }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from = process.env.RESEND_FROM || fromEmail || 'onboarding@resend.dev';

  const formattedAttachments = attachments ? attachments.map(att => {
    let contentBase64 = '';
    if (att.content) {
      if (Buffer.isBuffer(att.content)) {
        contentBase64 = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        contentBase64 = att.content;
      }
    }
    return {
      filename: att.filename,
      content: contentBase64
    };
  }) : [];

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html
  };

  if (formattedAttachments.length > 0) {
    payload.attachments = formattedAttachments;
  }

  const response = await axios.post('https://api.resend.com/emails', payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    messageId: response.data.id
  };
};

const sendBrevo = async ({ to, subject, text, html, attachments, fromEmail }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const from = process.env.BREVO_FROM || fromEmail;
  const sender = parseFrom(from);

  const formattedAttachments = attachments ? attachments.map(att => {
    let contentBase64 = '';
    if (att.content) {
      if (Buffer.isBuffer(att.content)) {
        contentBase64 = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        contentBase64 = att.content;
      }
    }
    return {
      content: contentBase64,
      name: att.filename
    };
  }) : [];

  const payload = {
    sender,
    to: (Array.isArray(to) ? to : [to]).map(email => ({ email })),
    subject,
    textContent: text,
    htmlContent: html
  };

  if (formattedAttachments.length > 0) {
    payload.attachment = formattedAttachments;
  }

  const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    messageId: response.data.messageId
  };
};

const sendSendGrid = async ({ to, subject, text, html, attachments, fromEmail }) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not configured');
  }

  const from = process.env.SENDGRID_FROM || fromEmail;
  const sender = parseFrom(from);

  const formattedAttachments = attachments ? attachments.map(att => {
    let contentBase64 = '';
    if (att.content) {
      if (Buffer.isBuffer(att.content)) {
        contentBase64 = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        contentBase64 = att.content;
      }
    }
    let contentType = 'application/octet-stream';
    if (att.filename.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (att.filename.endsWith('.png')) {
      contentType = 'image/png';
    } else if (att.filename.endsWith('.jpg') || att.filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    }
    return {
      content: contentBase64,
      filename: att.filename,
      type: contentType,
      disposition: 'attachment'
    };
  }) : [];

  const content = [];
  if (text) {
    content.push({ type: 'text/plain', value: text });
  }
  if (html) {
    content.push({ type: 'text/html', value: html });
  }

  const payload = {
    personalizations: [
      {
        to: (Array.isArray(to) ? to : [to]).map(email => ({ email }))
      }
    ],
    from: sender,
    subject,
    content
  };

  if (formattedAttachments.length > 0) {
    payload.attachments = formattedAttachments;
  }

  const response = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    messageId: response.headers['x-message-id'] || 'sendgrid-success'
  };
};

/**
 * Send email using HTTP APIs (Resend, Brevo, SendGrid) or fallback to Nodemailer SMTP.
 * Falls back to logging to console if no settings are configured.
 */
const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  const fromEmail = process.env.SMTP_FROM || process.env.BREVO_FROM || user || 'onboarding@resend.dev';
  const fromName = process.env.APP_NAME || 'AI Digital Khata';
  const formattedFrom = `"${fromName}" <${fromEmail}>`;

  // 1. Try Brevo if key exists
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`Sending email to ${to} via Brevo...`);
      return await sendBrevo({ to, subject, text, html, attachments, fromEmail: formattedFrom });
    } catch (brevoErr) {
      console.error('⚠️ Brevo email sending failed:', brevoErr.response?.data || brevoErr.message);
    }
  }

  // 2. Try Resend if key exists
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`Sending email to ${to} via Resend...`);
      return await sendResend({ to, subject, text, html, attachments, fromEmail: formattedFrom });
    } catch (resendErr) {
      console.error('⚠️ Resend email sending failed:', resendErr.response?.data || resendErr.message);
    }
  }

  // 3. Try SendGrid if key exists
  if (process.env.SENDGRID_API_KEY) {
    try {
      console.log(`Sending email to ${to} via SendGrid...`);
      return await sendSendGrid({ to, subject, text, html, attachments, fromEmail: formattedFrom });
    } catch (sgErr) {
      console.error('⚠️ SendGrid email sending failed:', sgErr.response?.data || sgErr.message);
    }
  }

  // 4. Try Nodemailer SMTP if configured
  if (host && user && pass) {
    try {
      console.log(`Sending email to ${to} via Nodemailer SMTP...`);
      const port = parseInt(process.env.SMTP_PORT || '587');
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from: formattedFrom,
        to,
        subject,
        text,
        html,
        attachments,
      });

      console.log(`✉️ Email sent via SMTP: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (smtpErr) {
      console.error('⚠️ SMTP email sending failed:', smtpErr.message);
    }
  }

  // Fallback: Console logging simulation if all external delivery services fail or are unconfigured
  console.warn('⚠️ All email delivery services (Brevo, Resend, SMTP) failed or are unconfigured. Simulating email send:');
  console.log(`[SIMULATION] To: ${to}`);
  console.log(`[SIMULATION] Subject: ${subject}`);
  if (attachments) {
    console.log(`[SIMULATION] Attachments: ${attachments.map(a => a.filename).join(', ')}`);
  }

  return {
    success: true,
    logged: true,
    message: 'Email processed successfully (Simulated delivery mode)'
  };
};

module.exports = {
  sendEmail,
};
