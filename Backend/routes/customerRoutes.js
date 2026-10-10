const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  verifyAddress,
  checkGpsDistance,
  deleteCustomer,
  getTrash,
  restoreCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const verifyBlockchain = require('../middleware/verifyBlockchain');

router.use(protect);
router.use(verifyBlockchain);

router.route('/trash').get(getTrash);
router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);
router.route('/:id/verify-address').put(verifyAddress);
router.route('/:id/check-gps').post(checkGpsDistance);
router.route('/:id/restore').post(restoreCustomer);

module.exports = router;
