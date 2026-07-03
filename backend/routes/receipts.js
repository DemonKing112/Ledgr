/* ──────────────────────────────────────────────────────────────
   RECEIPT ROUTES (STUBBED)
   This endpoint will eventually accept a photo of a receipt
   and use OCR to extract the amount, vendor, and date.
   For now it returns a placeholder response so the frontend
   can be built against the expected API shape.
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');

router.use(authenticate);

/* ── POST /api/receipts/scan ─────────────────────────────────
   Future: accepts an image file, runs OCR, returns extracted
   expense data.  Currently returns a stub response.            */
router.post('/scan', (req, res) => {
  res.status(202).json({
    message: 'Receipt scan is not yet implemented — this is a placeholder',
    extracted: {
      amount: null,
      vendor: null,
      date: null,
      confidence: 0,
    },
  });
});

module.exports = router;
