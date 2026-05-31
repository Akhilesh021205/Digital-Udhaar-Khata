const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { generateStatementBuffer } = require('../services/pdfService');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test() {
  console.log("Connecting to database...");
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/udhaar-khata');
    
    // Fetch first user (merchant)
    const user = await User.findOne({});
    if (!user) {
      console.log("No user found in the database. Please register a user first.");
      return;
    }
    
    // Fetch first customer belonging to this user
    const customer = await Customer.findOne({ creator: user._id });
    if (!customer) {
      console.log(`No customers found for user: ${user.name}. Please add a customer first.`);
      return;
    }

    // Fetch transactions for this customer
    const transactions = await Transaction.find({ customer: customer._id }).sort({ date: 1 });
    
    const store = {
      storeName: user.storeName || "My Store",
      name: user.name,
      phone: user.phone || "",
      upiId: user.upiId || ""
    };

    const dateRange = {
      startDate: "1/5/2026",
      endDate: "31/5/2026"
    };

    console.log(`Generating statement PDF for Merchant: "${store.name}", Customer: "${customer.name}"...`);
    const pdfBuffer = await generateStatementBuffer(store, customer, transactions, dateRange);
    const outputPath = path.join(__dirname, 'test_statement.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`Success! Real PDF generated and written to ${outputPath}`);

  } catch (err) {
    console.error("PDF generation failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
