const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initAutoReminderScheduler } = require('./services/autoReminderService');

// Load env vars
dotenv.config();

// Disable SSL certificate verification rejection for local development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Connect to database (restarted after starting MongoDB)
connectDB();

// Initialize AI Auto-Reminder Bot Scheduler
initAutoReminderScheduler();

const app = express();

// Performance Timing & Compression Middleware
const apiTimer = require('./middleware/apiTimer');
const compression = require('compression');

app.use(apiTimer);
app.use(compression());

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://digital-udhar-khata-frontend-458697683921-ap-south-2-an.s3-website.ap-south-2.amazonaws.com",
  "https://digital-udhaar-khata-qcyviongw-akhilesh021205s-projects.vercel.app",
  "https://digital-udhaar-khata-bfpbujuzd-akhilesh021205s-projects.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/reminder', require('./routes/reminderRoutes'));
app.use('/api/cashbook', require('./routes/cashbookRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));
app.use('/api/backup', require('./routes/backupRoutes'));
app.use('/api/blockchain', require('./routes/blockchainRoutes'));


// Webhook verification for WhatsApp Cloud API
app.get('/webhook', (req, res) => {
  const verifyToken = "udhar_verify_token";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Udhaar Khata API is running' });
});

// Admin-only Hidden Blockchain Status Endpoint
const BlockchainService = require('./services/blockchainService');
const { protect } = require('./middleware/authMiddleware');
const { authorizeRoles } = require('./middleware/roleMiddleware');
const BlockchainModel = require('./models/Blockchain');

let lastVerificationTime = new Date();

app.get('/admin/blockchain-status', protect, authorizeRoles('Admin'), async (req, res, next) => {
  try {
    // Run verification first to ensure data accuracy
    await BlockchainService.runScheduledAudit();
    lastVerificationTime = new Date();

    const totalBlocks = await BlockchainModel.countDocuments({});
    const verifiedBlocks = await BlockchainModel.countDocuments({ verificationStatus: true });
    const failedBlocks = await BlockchainModel.countDocuments({ verificationStatus: false });

    res.status(200).json({
      totalBlocks,
      verifiedBlocks,
      failedBlocks,
      lastVerification: lastVerificationTime.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Run scheduled blockchain verification every 10 minutes
setInterval(() => {
  BlockchainService.runScheduledAudit().then(() => {
    lastVerificationTime = new Date();
  });
}, 10 * 60 * 1000);

// Run initial audit on startup
setTimeout(() => {
  BlockchainService.runScheduledAudit().then(() => {
    lastVerificationTime = new Date();
  });
}, 5000);

// Error handler
app.use(errorHandler);

const http = require('http');
const socketService = require('./services/socketService');

const server = http.createServer(app);
server.keepAliveTimeout = 65000; // 65 seconds keep-alive timeout
server.headersTimeout = 66000;    // 66 seconds headers timeout
socketService.init(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
