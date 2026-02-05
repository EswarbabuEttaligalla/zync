/**
 * Validation Middleware
 * Input validation and sanitization
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

/**
 * User registration validation
 */
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  validate
];

/**
 * Login validation
 */
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

/**
 * Room creation validation
 */
const createRoomValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Room name must be 1-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be under 1000 characters'),
  body('topic')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Topic must be under 200 characters'),
  body('privacy')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('Privacy must be public or private'),
  body('category')
    .optional()
    .isIn(['politics', 'technology', 'science', 'philosophy', 'society', 'economics', 'environment', 'health', 'education', 'other'])
    .withMessage('Invalid category'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 200 })
    .withMessage('Max participants must be 2-200'),
  validate
];

/**
 * Message validation
 */
const messageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters'),
  validate
];

/**
 * Profile update validation
 */
const profileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  validate
];

/**
 * MongoDB ObjectId validation
 */
const objectIdValidation = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate
];

/**
 * Pagination validation
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  createRoomValidation,
  messageValidation,
  profileValidation,
  objectIdValidation,
  paginationValidation
};
