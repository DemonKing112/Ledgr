/* ──────────────────────────────────────────────────────────────
   INPUT VALIDATION RULES
   Uses express-validator to make sure incoming data is clean
   before it touches the database.  Each export is an array of
   validation rules you attach to a route.
   ────────────────────────────────────────────────────────────── */

const { body, param, validationResult } = require('express-validator');

/* Helper that runs after the validation rules — if anything
   failed it sends back the list of problems and stops.         */
function handleErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }
  next();
}

/* ── Signup rules ────────────────────────────────────────────── */
const signupRules = [
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 characters)')
    .escape(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleErrors,
];

/* ── Login rules ─────────────────────────────────────────────── */
const loginRules = [
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleErrors,
];

/* ── Expense rules ───────────────────────────────────────────── */
const expenseRules = [
  body('amount')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage('Description is required (max 500 characters)')
    .escape(),
  body('date')
    .isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
  body('category_id')
    .optional({ nullable: true })
    .isInt().withMessage('Category ID must be a number'),
  body('project_id')
    .optional({ nullable: true })
    .isInt().withMessage('Project ID must be a number'),
  handleErrors,
];

/* ── ID parameter rule ───────────────────────────────────────── */
const idParam = [
  param('id').isInt().withMessage('ID must be a number'),
  handleErrors,
];

/* ── Category rules ──────────────────────────────────────────── */
const categoryRules = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Category name is required (max 50 characters)')
    .escape(),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a hex code like #FF5733'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Icon name too long')
    .escape(),
  handleErrors,
];

/* ── Project rules ───────────────────────────────────────────── */
const projectRules = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Project name is required (max 100 characters)')
    .escape(),
  body('client_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Client name max 100 characters')
    .escape(),
  handleErrors,
];

/* ── Profile update rules ────────────────────────────────────── */
const updateProfileRules = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 characters)')
    .escape(),
  handleErrors,
];

/* ── Password change rules ───────────────────────────────────── */
const changePasswordRules = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  handleErrors,
];

/* ── Forgot / reset password rules ───────────────────────────── */
const forgotPasswordRules = [
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
  handleErrors,
];

const resetPasswordRules = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  handleErrors,
];

/* ── Budget rules ─────────────────────────────────────────────── */
const budgetRules = [
  body('category_id')
    .isInt().withMessage('Category ID must be a number'),
  body('monthly_limit')
    .isFloat({ min: 0.01 }).withMessage('Monthly limit must be a positive number'),
  handleErrors,
];

module.exports = {
  signupRules,
  loginRules,
  expenseRules,
  idParam,
  categoryRules,
  projectRules,
  updateProfileRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
  budgetRules,
};
