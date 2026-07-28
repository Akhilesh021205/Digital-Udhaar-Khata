const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const CustomerHistory = require('../models/CustomerHistory');
const { updateRiskLevel } = require('../services/riskService');
const socketService = require('../services/socketService');
const BlockchainService = require('../services/blockchainService');
const cache = require('../utils/cache');

// @desc    Get all transactions for logged-in owner
// @route   GET /api/transactions
const getTransactions = async (req, res, next) => {
  try {
    const { type, customer, startDate, endDate, limit, status } = req.query;
    let query = { owner: req.user._id };

    if (type && ['credit', 'debit'].includes(type)) {
      query.type = type;
    }

    if (customer) {
      query.customer = customer;
    }

    if (status && ['PENDING', 'SETTLED', 'FAILED', 'Cancelled', 'CANCELLED'].includes(status)) {
      query.paymentStatus = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const queryLimit = parseInt(limit) || 100;

    const transactions = await Transaction.find(query)
      .populate('customer', 'name phone')
      .sort({ date: -1 })
      .limit(queryLimit)
      .lean();

    const decryptCustomerField = Customer.decryptCustomerField;
    const processedTransactions = transactions.map(tx => {
      if (tx.customer && tx.customer.phone) {
        tx.customer.phone = decryptCustomerField(tx.customer.phone);
      }
      return tx;
    });

    res.status(200).json({
      success: true,
      count: processedTransactions.length,
      data: processedTransactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create transaction and update customer balance
// @route   POST /api/transactions
const createTransaction = async (req, res, next) => {
  try {
    const { customer: customerId, type, amount, description, date, billImageUrl, paymentMode } = req.body;

    // Verify customer belongs to this owner
    const customer = await Customer.findOne({
      _id: customerId,
      owner: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Create transaction
    const transaction = await Transaction.create({
      customer: customerId,
      owner: req.user._id,
      type,
      amount: parseFloat(amount),
      description,
      billImageUrl: billImageUrl || '',
      paymentStatus: type === 'debit' ? 'SETTLED' : 'PENDING',
      paymentMode: paymentMode || (type === 'debit' ? 'cash' : 'none'),
      date: date || Date.now(),
    });

    // Create block in private blockchain for tamper-evident ledger (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, customerId, transaction.amount, transaction.type)
      .catch(err => console.error('Background blockchain block creation failed in createTransaction:', err));

    // Invalidate stats cache since transaction was added
    cache.invalidatePrefix(`stats_${req.user._id}`);

    // Update customer balance
    if (type === 'credit') {
      customer.balance += parseFloat(amount);
    } else if (type === 'debit') {
      customer.balance -= parseFloat(amount);
      customer.lastPaymentDate = new Date();
    }
    customer.totalTransactions = (customer.totalTransactions || 0) + 1;
    await customer.save();

    // Trigger immediate automated transaction notification (Bill or Payment Confirmation) via AI Bot
    if (customer.email) {
      const { sendTransactionEmail } = require('../services/transactionMailService');
      sendTransactionEmail(transaction._id).catch(err => console.error('Error sending transaction email:', err));
    }

    // Log to permanent customer history
    await CustomerHistory.create({
      owner: req.user._id,
      customerId: customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      transactionId: transaction._id,
      type: type,
      amount: parseFloat(amount),
      description: description || '',
      date: transaction.date,
      action: 'CREATE'
    });

    // Update risk level asynchronously
    updateRiskLevel(customerId).catch(() => {});

    // Populate customer info for response
    await transaction.populate('customer', 'name phone balance');

    socketService.emitRefresh('transactions');

    res.status(201).json({
      success: true,
      data: transaction,
      updatedBalance: customer.balance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark transaction as settled
// @route   PUT /api/transactions/:id/settle
const settleTransaction = async (req, res, next) => {
  try {
    if (req.user.role === 'Employee') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employees are not authorized to modify ledger records.',
      });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    if (transaction.paymentStatus === 'SETTLED') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already settled',
      });
    }

    transaction.paymentStatus = 'SETTLED';
    await transaction.save();

    // Create a new block representing the updated settled state (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, transaction.customer, transaction.amount, 'SETTLE')
      .catch(err => console.error('Background blockchain block creation failed in settleTransaction:', err));

    // Invalidate stats cache
    cache.invalidatePrefix(`stats_${req.user._id}`);

    // Adjust the customer's balance
    const customer = await Customer.findOne({ _id: transaction.customer, owner: req.user._id });
    if (customer) {
      if (transaction.type === 'credit') {
        customer.balance -= transaction.amount;
        customer.lastPaymentDate = new Date();
      } else if (transaction.type === 'debit') {
        customer.balance += transaction.amount;
      }
      await customer.save();

      // Trigger auto receipt if a credit transaction was marked as settled (Paid)
      if (transaction.type === 'credit' && customer.email) {
        const { sendTransactionEmail } = require('../services/transactionMailService');
        sendTransactionEmail(transaction._id).catch(err => console.error('Error sending auto-receipt:', err));
      }

      // Log to permanent customer history
      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: `Settle transaction: ${transaction.description || ''}`,
        date: new Date(),
        action: 'UPDATE'
      });

      // Update risk level
      updateRiskLevel(customer._id).catch(() => {});
    }

    socketService.emitRefresh('transactions');

    res.status(200).json({
      success: true,
      message: 'Transaction marked as settled',
      data: transaction,
      updatedBalance: customer ? customer.balance : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction and reverse balance
// @route   DELETE /api/transactions/:id
const deleteTransaction = async (req, res, next) => {
  try {
    if (req.user.role === 'Employee') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employees are not authorized to modify ledger records.',
      });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Reverse the balance
    const customer = await Customer.findById(transaction.customer);
    if (customer) {
      if (transaction.type === 'credit') {
        customer.balance -= transaction.amount;
      } else if (transaction.type === 'debit') {
        customer.balance += transaction.amount;
      }
      customer.totalTransactions = Math.max(0, (customer.totalTransactions || 0) - 1);
      await customer.save();

      // Log to permanent customer history
      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        description: `Deleted transaction: ${transaction.description || ''}`,
        date: new Date(),
        action: 'DELETE'
      });

      // Update risk level
      updateRiskLevel(customer._id).catch(() => {});
    }

    // Instead of deleting the record, mark it as Cancelled
    transaction.paymentStatus = 'Cancelled';
    await transaction.save();

    // Create a new block representing the cancelled state (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, transaction.customer, transaction.amount, 'CANCEL')
      .catch(err => console.error('Background blockchain block creation failed in deleteTransaction:', err));

    // Invalidate stats cache
    cache.invalidatePrefix(`stats_${req.user._id}`);

    socketService.emitRefresh('transactions');

    res.status(200).json({
      success: true,
      message: 'Transaction deleted and balance reversed',
      updatedBalance: customer ? customer.balance : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update transaction and adjust customer balance
// @route   PUT /api/transactions/:id
const updateTransaction = async (req, res, next) => {
  try {
    if (req.user.role === 'Employee') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employees are not authorized to modify ledger records.',
      });
    }

    const { amount, description, date, paymentStatus, paymentMode, billImageUrl } = req.body;
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const oldAmount = transaction.amount;
    const newAmount = parseFloat(amount);

    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount',
      });
    }

    const newStatus = paymentStatus || transaction.paymentStatus;

    // Adjust the customer's balance
    const customer = await Customer.findOne({ _id: transaction.customer, owner: req.user._id });
    if (customer) {
      // 1. Reverse the effect of the old transaction
      if (transaction.type === 'credit') {
        if (transaction.paymentStatus === 'PENDING') {
          customer.balance -= oldAmount;
        }
      } else if (transaction.type === 'debit') {
        customer.balance += oldAmount;
      }

      // 2. Apply the effect of the new transaction
      if (transaction.type === 'credit') {
        if (newStatus === 'PENDING') {
          customer.balance += newAmount;
        } else if (newStatus === 'SETTLED') {
          customer.lastPaymentDate = new Date();
        }
      } else if (transaction.type === 'debit') {
        customer.balance -= newAmount;
        customer.lastPaymentDate = new Date();
      }

      await customer.save();

      // Update risk level
      updateRiskLevel(customer._id).catch(() => {});
    }

    transaction.amount = newAmount;
    if (description !== undefined) transaction.description = description;
    if (date) transaction.date = date;
    if (paymentStatus) transaction.paymentStatus = paymentStatus;
    if (paymentMode) transaction.paymentMode = paymentMode;
    if (billImageUrl !== undefined) transaction.billImageUrl = billImageUrl;

    await transaction.save();

    // Create a new block representing the updated state (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, transaction.customer, transaction.amount, 'UPDATE')
      .catch(err => console.error('Background blockchain block creation failed in updateTransaction:', err));

    // Invalidate stats cache
    cache.invalidatePrefix(`stats_${req.user._id}`);

    // Trigger immediate automated transaction notification (Bill or Payment Receipt) via AI Bot
    if (customer && customer.email) {
      const { sendTransactionEmail } = require('../services/transactionMailService');
      sendTransactionEmail(transaction._id).catch(err => console.error('Error sending transaction email:', err));
    }

    if (customer) {
      // Log to permanent customer history
      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: transaction._id,
        type: transaction.type,
        amount: newAmount,
        description: `Update transaction (Old amount: ₹${oldAmount}). New Desc: ${description || ''}`,
        date: transaction.date,
        action: 'UPDATE'
      });
    }

    socketService.emitRefresh('transactions');

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction,
      updatedBalance: customer ? customer.balance : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/transactions/stats
const getStats = async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const cacheKey = `stats_${ownerId}`;

    // Check Cache
    const cachedStats = cache.get(cacheKey);
    if (cachedStats) {
      return res.status(200).json({
        success: true,
        data: cachedStats,
      });
    }

    // Today's transactions start time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      balanceAgg,
      todayTransactions,
      todayAgg,
      customersWithDues,
      highRiskCount,
      pendingTransactions
    ] = await Promise.all([
      Customer.countDocuments({ owner: ownerId }),
      Customer.aggregate([
        { $match: { owner: ownerId } },
        {
          $group: {
            _id: null,
            youWillGet: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
            youWillGive: { $sum: { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] } },
          },
        },
      ]),
      Transaction.countDocuments({
        owner: ownerId,
        date: { $gte: todayStart },
      }),
      Transaction.aggregate([
        { $match: { owner: ownerId, date: { $gte: todayStart } } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ]),
      Customer.countDocuments({
        owner: ownerId,
        balance: { $gt: 0 },
      }),
      Customer.countDocuments({
        owner: ownerId,
        riskLevel: 'high',
      }),
      Transaction.countDocuments({
        owner: ownerId,
        paymentStatus: 'PENDING',
        type: 'credit',
      })
    ]);

    const todayCredit = todayAgg.find((a) => a._id === 'credit')?.total || 0;
    const todayDebit = todayAgg.find((a) => a._id === 'debit')?.total || 0;

    const statsData = {
      totalCustomers,
      youWillGet: balanceAgg[0]?.youWillGet || 0,
      youWillGive: balanceAgg[0]?.youWillGive || 0,
      todayTransactions,
      todayCredit,
      todayDebit,
      customersWithDues,
      highRiskCount,
      pendingTransactions,
    };

    // Cache stats for 15 seconds
    cache.set(cacheKey, statsData, 15000);

    res.status(200).json({
      success: true,
      data: statsData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Settle a pending debit payment transaction
// @route   PUT /api/transactions/:id/approve
const approveTransaction = async (req, res, next) => {
  try {
    if (req.user.role === 'Employee') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employees are not authorized to modify ledger records.',
      });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    if (transaction.paymentStatus === 'SETTLED') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already settled',
      });
    }

    transaction.paymentStatus = 'SETTLED';
    await transaction.save();

    // Create a new block representing the approved state (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, transaction.customer, transaction.amount, 'APPROVE')
      .catch(err => console.error('Background blockchain block creation failed in approveTransaction:', err));

    // Invalidate stats cache
    cache.invalidatePrefix(`stats_${req.user._id}`);

    const customer = await Customer.findOne({ _id: transaction.customer, owner: req.user._id });
    if (customer) {
      if (transaction.type === 'debit') {
        customer.balance = Math.max(0, customer.balance - transaction.amount);
        customer.lastPaymentDate = new Date();
      } else if (transaction.type === 'credit') {
        customer.balance += transaction.amount;
      }
      await customer.save();

      // Trigger immediate automated transaction notification via AI Bot
      if (customer.email) {
        const { sendTransactionEmail } = require('../services/transactionMailService');
        sendTransactionEmail(transaction._id).catch(err => console.error('Error sending transaction email:', err));
      }

      // Log to permanent customer history
      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: customer.balance,
        date: new Date(),
        action: 'UPDATE',
        description: `Approved payment transaction: ${transaction.description}`,
      });
      
      // Update risk level
      await updateRiskLevel(customer._id);
    }

    socketService.emitRefresh('transactions');

    res.status(200).json({
      success: true,
      message: 'Transaction payment approved successfully.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline/Reject a pending debit payment transaction
// @route   PUT /api/transactions/:id/decline
const declineTransaction = async (req, res, next) => {
  try {
    if (req.user.role === 'Employee') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employees are not authorized to modify ledger records.',
      });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    if (transaction.paymentStatus === 'SETTLED' || transaction.paymentStatus === 'FAILED') {
      return res.status(400).json({
        success: false,
        message: `Transaction is already ${transaction.paymentStatus.toLowerCase()}`,
      });
    }

    transaction.paymentStatus = 'FAILED';
    await transaction.save();

    // Create a new block representing the declined state (runs in background)
    BlockchainService.createBlock(req.user._id, transaction._id, transaction.customer, transaction.amount, 'DECLINE')
      .catch(err => console.error('Background blockchain block creation failed in declineTransaction:', err));

    // Invalidate stats cache
    cache.invalidatePrefix(`stats_${req.user._id}`);

    const customer = await Customer.findOne({ _id: transaction.customer, owner: req.user._id });
    if (customer) {
      // Log to permanent customer history
      const CustomerHistory = require('../models/CustomerHistory');
      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        transactionId: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: customer.balance,
        date: new Date(),
        action: 'UPDATE',
        description: `Declined payment transaction (Verification Failed): ${transaction.description}`,
      });
      
      // Update risk level
      await updateRiskLevel(customer._id);
    }

    socketService.emitRefresh('transactions');

    res.status(200).json({
      success: true,
      message: 'Transaction payment declined successfully.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  settleTransaction,
  approveTransaction,
  declineTransaction,
  deleteTransaction,
  updateTransaction,
  getStats,
};
