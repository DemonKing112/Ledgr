const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  business: process.env.STRIPE_BIZ_PRICE_ID,
};

router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard.html?upgraded=true`,
      cancel_url: `${process.env.FRONTEND_URL}/index.html#pricing`,
      metadata: { userId: String(user.id), plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    const customerId = rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

router.get('/status', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT plan, stripe_subscription_id FROM users WHERE id = $1', [req.userId]
    );
    res.json({ plan: rows[0]?.plan || 'free', subscriptionId: rows[0]?.stripe_subscription_id });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
