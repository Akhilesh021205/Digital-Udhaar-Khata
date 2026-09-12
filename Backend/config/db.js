const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Sync Transaction indexes to drop outdated sparse indexes clashing on null values
    const Transaction = require('../models/Transaction');
    await Transaction.syncIndexes().catch(err => console.warn('Transaction index sync warning:', err.message));
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
