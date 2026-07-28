const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const CustomerHistory = require('../models/CustomerHistory');
const dns = require('dns').promises;
const socketService = require('../services/socketService');
const cache = require('../utils/cache');

const validateEmailExists = async (email) => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// @desc    Get all customers for logged-in owner
// @route   GET /api/customers
const getCustomers = async (req, res, next) => {
  try {
    const { search, sort } = req.query;

    // Check Cache
    const cacheKey = `customers_${req.user._id}_${search || ''}_${sort || ''}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        count: cachedData.length,
        data: cachedData,
      });
    }

    let query = { owner: req.user._id, isDeleted: { $ne: true } };

    // Search by name or phone (using phoneHash for encrypted phone)
    if (search) {
      const crypto = require('crypto');
      const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
        ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
        : crypto.scryptSync(process.env.JWT_SECRET || 'fallback_secret_for_digital_udhaar_khata', 'salt', 32);
      const searchHash = crypto.createHmac('sha256', ENCRYPTION_KEY).update(search).digest('hex');

      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneHash: searchHash },
      ];
    }

    // Sort options
    let sortOption = { createdAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    if (sort === 'balance-high') sortOption = { balance: -1 };
    if (sort === 'balance-low') sortOption = { balance: 1 };

    const customers = await Customer.find(query).sort(sortOption).lean();

    // Decrypt lean documents
    const decryptCustomerField = Customer.decryptCustomerField;
    const decryptedCustomers = customers.map(cust => {
      if (cust.phone) cust.phone = decryptCustomerField(cust.phone);
      if (cust.address) cust.address = decryptCustomerField(cust.address);
      if (cust.notes) cust.notes = decryptCustomerField(cust.notes);
      return cust;
    });

    // Save to Cache (expires in 15 seconds)
    cache.set(cacheKey, decryptedCustomers, 15000);

    res.status(200).json({
      success: true,
      count: decryptedCustomers.length,
      data: decryptedCustomers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer with transactions
// @route   GET /api/customers/:id
const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: { $ne: true }
    }).lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Decrypt lean customer object
    const decryptCustomerField = Customer.decryptCustomerField;
    if (customer.phone) customer.phone = decryptCustomerField(customer.phone);
    if (customer.address) customer.address = decryptCustomerField(customer.address);
    if (customer.notes) customer.notes = decryptCustomerField(customer.notes);

    const transactions = await Transaction.find({
      customer: customer._id,
    }).sort({ date: -1 }).lean();

    res.status(200).json({
      success: true,
      data: { customer, transactions },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new customer
// @route   POST /api/customers
const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, notes, avatar, paymentDueDate } = req.body;

    // Check if email exists/is valid if provided
    if (email && !(await validateEmailExists(email))) {
      return res.status(400).json({
        success: false,
        message: 'customer email is invalid / customer id is invalid',
      });
    }

    const crypto = require('crypto');
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
      ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
      : crypto.scryptSync(process.env.JWT_SECRET || 'fallback_secret_for_digital_udhaar_khata', 'salt', 32);
    const phoneHash = crypto.createHmac('sha256', ENCRYPTION_KEY).update(phone).digest('hex');

    // Check for duplicate phone under same owner
    const existing = await Customer.findOne({ phoneHash, owner: req.user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A customer with this phone number already exists',
      });
    }

    const customer = await Customer.create({
      name,
      phone,
      email: email || '',
      address: address || '',
      notes: notes || '',
      avatar: avatar || '',
      paymentDueDate: paymentDueDate || null,
      owner: req.user._id,
    });

    // Log to permanent customer history
    await CustomerHistory.create({
      owner: req.user._id,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: 'customer_created',
      amount: 0,
      description: 'New customer account created',
      date: new Date(),
      action: 'CREATE'
    });

    cache.invalidatePrefix(`customers_${req.user._id}`);
    socketService.emitRefresh('customers');

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
const updateCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, notes, avatar, paymentDueDate } = req.body;

    // Check if email exists/is valid if provided
    if (email && !(await validateEmailExists(email))) {
      return res.status(400).json({
        success: false,
        message: 'customer email is invalid / customer id is invalid',
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: { $ne: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (email !== undefined) customer.email = email || '';
    if (address !== undefined) customer.address = address;
    if (notes !== undefined) customer.notes = notes;
    if (avatar !== undefined) customer.avatar = avatar;
    if (paymentDueDate !== undefined) customer.paymentDueDate = paymentDueDate || null;

    await customer.save();

    cache.invalidatePrefix(`customers_${req.user._id}`);
    socketService.emitRefresh('customers');

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Move customer to trash (Soft Delete)
// @route   DELETE /api/customers/:id
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: { $ne: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Soft delete customer
    customer.isDeleted = true;
    customer.deletedAt = new Date();
    await customer.save();

    // Log to permanent customer history
    await CustomerHistory.create({
      owner: req.user._id,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: 'customer_deleted',
      amount: customer.balance,
      description: `Customer moved to Trash. Final ledger balance: ₹${customer.balance}`,
      date: new Date(),
      action: 'CUSTOMER_DELETED'
    });

    cache.invalidatePrefix(`customers_${req.user._id}`);
    socketService.emitRefresh('customers');

    res.status(200).json({
      success: true,
      message: 'Customer moved to Trash. You can restore it within 30 days.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trashed (soft-deleted) customers
// @route   GET /api/customers/trash
const getTrash = async (req, res, next) => {
  try {
    // Auto purge expired items (> 30 days old)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expiredCustomers = await Customer.find({
      owner: req.user._id,
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });

    for (const cust of expiredCustomers) {
      await Transaction.deleteMany({ customer: cust._id });
      await Customer.findByIdAndDelete(cust._id);
    }

    // Return remaining trashed customers
    const trashedCustomers = await Customer.find({
      owner: req.user._id,
      isDeleted: true
    }).sort({ deletedAt: -1 });

    res.status(200).json({
      success: true,
      count: trashedCustomers.length,
      data: trashedCustomers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore customer from trash
// @route   POST /api/customers/:id/restore
const restoreCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found in Trash',
      });
    }

    // Log to permanent customer history
    await CustomerHistory.create({
      owner: req.user._id,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: 'customer_restored',
      amount: customer.balance,
      description: 'Customer restored from Trash',
      date: new Date(),
      action: 'CREATE'
    });

    cache.invalidatePrefix(`customers_${req.user._id}`);
    socketService.emitRefresh('customers');

    res.status(200).json({
      success: true,
      message: 'Customer restored successfully',
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getTrash,
  restoreCustomer,
};
