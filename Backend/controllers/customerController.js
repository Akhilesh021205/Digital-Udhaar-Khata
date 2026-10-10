const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const CustomerHistory = require('../models/CustomerHistory');
const AuditLog = require('../models/AuditLog');
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

    const customers = await Customer.find(query).populate('verifiedBy', 'name email').sort(sortOption).lean();

    // Decrypt lean documents
    const decryptCustomerField = Customer.decryptCustomerField;
    const decryptedCustomers = customers.map(cust => {
      if (cust.phone) cust.phone = decryptCustomerField(cust.phone);
      if (cust.address) cust.address = decryptCustomerField(cust.address);
      if (cust.notes) cust.notes = decryptCustomerField(cust.notes);
      if (cust.houseNumber) cust.houseNumber = decryptCustomerField(cust.houseNumber);
      if (cust.street) cust.street = decryptCustomerField(cust.street);
      if (cust.area) cust.area = decryptCustomerField(cust.area);
      if (cust.city) cust.city = decryptCustomerField(cust.city);
      if (cust.state) cust.state = decryptCustomerField(cust.state);
      if (cust.pincode) cust.pincode = decryptCustomerField(cust.pincode);
      if (cust.verificationNote) cust.verificationNote = decryptCustomerField(cust.verificationNote);

      // Harmonize status: 0-balance with no transactions is 'new'; 0-balance with transactions is 'cleared'
      cust.totalTransactions = cust.totalTransactions || 0;
      if (cust.balance === 0) {
        if (cust.totalTransactions > 0 || cust.duePrediction === 'cleared') {
          cust.duePrediction = 'cleared';
        } else {
          cust.duePrediction = 'new';
        }
      }
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
    }).populate('verifiedBy', 'name email').lean();

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
    if (customer.houseNumber) customer.houseNumber = decryptCustomerField(customer.houseNumber);
    if (customer.street) customer.street = decryptCustomerField(customer.street);
    if (customer.area) customer.area = decryptCustomerField(customer.area);
    if (customer.city) customer.city = decryptCustomerField(customer.city);
    if (customer.state) customer.state = decryptCustomerField(customer.state);
    if (customer.pincode) customer.pincode = decryptCustomerField(customer.pincode);
    if (customer.verificationNote) customer.verificationNote = decryptCustomerField(customer.verificationNote);

    const transactions = await Transaction.find({
      customer: customer._id,
    }).sort({ date: -1 }).lean();

    customer.totalTransactions = customer.totalTransactions || transactions.length || 0;
    if (customer.balance === 0) {
      if (customer.totalTransactions > 0 || customer.duePrediction === 'cleared') {
        customer.duePrediction = 'cleared';
      } else {
        customer.duePrediction = 'new';
      }
    }

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
    const {
      name,
      phone,
      email,
      address,
      notes,
      avatar,
      paymentDueDate,
      preferredLanguage,
      phoneType,
      aiReminderEnabled,
      houseNumber,
      street,
      area,
      city,
      state,
      pincode,
      latitude,
      longitude
    } = req.body;

    // Check if email exists/is valid if provided
    if (email && !(await validateEmailExists(email))) {
      return res.status(400).json({
        success: false,
        message: 'customer email is invalid / customer id is invalid',
      });
    }

    // Validate pincode if provided (should be 6 digits if Indian pincode)
    if (pincode && pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PIN code. PIN code must be a 6-digit number.',
      });
    }

    // Validate lat/lng if provided
    if (latitude !== undefined && latitude !== null && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude value. Must be between -90 and 90.',
      });
    }

    if (longitude !== undefined && longitude !== null && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude value. Must be between -180 and 180.',
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
      preferredLanguage: preferredLanguage || 'te-IN',
      phoneType: phoneType || 'smartphone',
      aiReminderEnabled: aiReminderEnabled !== undefined ? aiReminderEnabled : true,
      houseNumber: houseNumber || '',
      street: street || '',
      area: area || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
      addressVerificationStatus: 'pending',
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
      description: 'New customer account created (Address verification pending)',
      date: new Date(),
      action: 'CREATE'
    });

    await AuditLog.create({
      action: 'CUSTOMER_CREATED',
      userId: req.user._id,
      status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      device: req.headers['user-agent'] || 'Unknown'
    });

    cache.invalidatePrefix(`customers_${req.user._id}`);
    cache.invalidatePrefix(`stats_${req.user._id}`);
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
    const {
      name,
      phone,
      email,
      address,
      notes,
      avatar,
      paymentDueDate,
      preferredLanguage,
      phoneType,
      aiReminderEnabled,
      houseNumber,
      street,
      area,
      city,
      state,
      pincode,
      latitude,
      longitude
    } = req.body;

    // Check if email exists/is valid if provided
    if (email && !(await validateEmailExists(email))) {
      return res.status(400).json({
        success: false,
        message: 'customer email is invalid / customer id is invalid',
      });
    }

    if (pincode && pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PIN code. PIN code must be a 6-digit number.',
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

    // Check if address/houseNumber/location fields are being changed
    const addressChanged = (
      (houseNumber !== undefined && houseNumber !== customer.houseNumber) ||
      (street !== undefined && street !== customer.street) ||
      (area !== undefined && area !== customer.area) ||
      (city !== undefined && city !== customer.city) ||
      (state !== undefined && state !== customer.state) ||
      (pincode !== undefined && pincode !== customer.pincode) ||
      (address !== undefined && address !== customer.address) ||
      (latitude !== undefined && latitude !== customer.latitude) ||
      (longitude !== undefined && longitude !== customer.longitude)
    );

    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (email !== undefined) customer.email = email || '';
    if (address !== undefined) customer.address = address;
    if (notes !== undefined) customer.notes = notes;
    if (avatar !== undefined) customer.avatar = avatar;
    if (paymentDueDate !== undefined) customer.paymentDueDate = paymentDueDate || null;
    if (preferredLanguage !== undefined) customer.preferredLanguage = preferredLanguage;
    if (phoneType !== undefined) customer.phoneType = phoneType;
    if (aiReminderEnabled !== undefined) customer.aiReminderEnabled = aiReminderEnabled;

    if (houseNumber !== undefined) customer.houseNumber = houseNumber;
    if (street !== undefined) customer.street = street;
    if (area !== undefined) customer.area = area;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pincode !== undefined) customer.pincode = pincode;
    if (latitude !== undefined) customer.latitude = latitude !== null ? Number(latitude) : null;
    if (longitude !== undefined) customer.longitude = longitude !== null ? Number(longitude) : null;

    // Automatic reset: If address was changed and status was verified/mismatch/rejected, reset to pending
    if (addressChanged && customer.addressVerificationStatus !== 'pending') {
      customer.addressVerificationStatus = 'pending';
      customer.verifiedBy = null;
      customer.verifiedAt = null;

      await CustomerHistory.create({
        owner: req.user._id,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        type: 'customer_created',
        amount: 0,
        description: 'Customer address modified after verification. Verification status automatically reset to PENDING.',
        date: new Date(),
        action: 'UPDATE'
      });

      await AuditLog.create({
        action: 'ADDRESS_STATUS_RESET_PENDING',
        userId: req.user._id,
        status: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        device: req.headers['user-agent'] || 'Unknown'
      });
    }

    await customer.save();

    cache.invalidatePrefix(`customers_${req.user._id}`);
    cache.invalidatePrefix(`stats_${req.user._id}`);
    socketService.emitRefresh('customers');

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify or update customer address verification status
// @route   PUT /api/customers/:id/verify-address
const verifyAddress = async (req, res, next) => {
  try {
    const { status, note, evidence } = req.body;

    const validStatuses = ['pending', 'verified', 'mismatch', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status. Must be pending, verified, mismatch, or rejected.',
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or unauthorized',
      });
    }

    customer.addressVerificationStatus = status;
    if (note !== undefined) customer.verificationNote = note;
    if (evidence !== undefined) customer.verificationEvidence = evidence;
    customer.verifiedBy = req.user._id;
    customer.verifiedAt = new Date();

    await customer.save();

    // Log to CustomerHistory
    await CustomerHistory.create({
      owner: req.user._id,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: 'customer_created',
      amount: 0,
      description: `Address verification status updated to ${status.toUpperCase()}${note ? `. Note: ${note}` : ''}`,
      date: new Date(),
      action: 'UPDATE'
    });

    // Log to AuditLog
    await AuditLog.create({
      action: `ADDRESS_${status.toUpperCase()}`,
      userId: req.user._id,
      status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      device: req.headers['user-agent'] || 'Unknown'
    });

    cache.invalidatePrefix(`customers_${req.user._id}`);
    cache.invalidatePrefix(`stats_${req.user._id}`);
    socketService.emitRefresh('customers');

    // Return populated customer
    const updatedCustomer = await Customer.findById(customer._id).populate('verifiedBy', 'name email').lean();
    const decryptCustomerField = Customer.decryptCustomerField;
    if (updatedCustomer.phone) updatedCustomer.phone = decryptCustomerField(updatedCustomer.phone);
    if (updatedCustomer.address) updatedCustomer.address = decryptCustomerField(updatedCustomer.address);
    if (updatedCustomer.notes) updatedCustomer.notes = decryptCustomerField(updatedCustomer.notes);
    if (updatedCustomer.houseNumber) updatedCustomer.houseNumber = decryptCustomerField(updatedCustomer.houseNumber);
    if (updatedCustomer.street) updatedCustomer.street = decryptCustomerField(updatedCustomer.street);
    if (updatedCustomer.area) updatedCustomer.area = decryptCustomerField(updatedCustomer.area);
    if (updatedCustomer.city) updatedCustomer.city = decryptCustomerField(updatedCustomer.city);
    if (updatedCustomer.state) updatedCustomer.state = decryptCustomerField(updatedCustomer.state);
    if (updatedCustomer.pincode) updatedCustomer.pincode = decryptCustomerField(updatedCustomer.pincode);
    if (updatedCustomer.verificationNote) updatedCustomer.verificationNote = decryptCustomerField(updatedCustomer.verificationNote);

    res.status(200).json({
      success: true,
      message: `Address verification status set to ${status}`,
      data: updatedCustomer,
    });
  } catch (error) {
    next(error);
  }
};

// Helper for Haversine distance in meters
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// @desc    Check current GPS location against customer address coordinates
// @route   POST /api/customers/:id/check-gps
const checkGpsDistance = async (req, res, next) => {
  try {
    const { gpsLatitude, gpsLongitude, thresholdMeters = 200 } = req.body;

    if (gpsLatitude === undefined || gpsLongitude === undefined || isNaN(gpsLatitude) || isNaN(gpsLongitude)) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS latitude and longitude are required.',
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or unauthorized',
      });
    }

    if (customer.latitude === null || customer.longitude === null || customer.latitude === undefined || customer.longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Customer does not have map location coordinates saved. Please select location on Google Maps first.',
      });
    }

    const distance = calculateDistanceMeters(
      parseFloat(gpsLatitude),
      parseFloat(gpsLongitude),
      customer.latitude,
      customer.longitude
    );

    const isMatch = distance <= thresholdMeters;
    const gpsStatus = isMatch ? 'matched' : 'mismatch';

    res.status(200).json({
      success: true,
      data: {
        distanceMeters: distance,
        isMatch,
        status: gpsStatus,
        thresholdMeters,
        customerCoordinates: {
          latitude: customer.latitude,
          longitude: customer.longitude,
        },
        capturedCoordinates: {
          latitude: parseFloat(gpsLatitude),
          longitude: parseFloat(gpsLongitude),
        }
      },
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
    cache.invalidatePrefix(`stats_${req.user._id}`);
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
    cache.invalidatePrefix(`stats_${req.user._id}`);
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
  verifyAddress,
  checkGpsDistance,
  deleteCustomer,
  getTrash,
  restoreCustomer,
};
