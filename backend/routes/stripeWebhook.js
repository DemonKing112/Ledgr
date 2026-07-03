const express = require('express');
const router = express.Router();
const db = require('../db/schema');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await db.query(
            'UPDATE users SET plan = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3',
            [plan, session.subscription, userId]
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const { rows } = await db.query(
          'SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]
        );
        if (rows.length > 0) {
          const status = sub.status;
          if (status === 'active' || status === 'trialing') {
            const priceId = sub.items?.data?.[0]?.price?.id;
            let plan = 'pro';
            if (priceId === process.env.STRIPE_BIZ_PRICE_ID) plan = 'business';
            await db.query(
              'UPDATE users SET plan = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3',
              [plan, sub.id, rows[0].id]
            );
          } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
            await db.query(
              'UPDATE users SET plan = $1, stripe_subscription_id = NULL, updated_at = NOW() WHERE id = $2',
              ['free', rows[0].id]
            );
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;
        await db.query(
          "UPDATE users SET plan = 'free', stripe_subscription_id = NULL, updated_at = NOW() WHERE stripe_customer_id = $1",
          [customerId]
        );
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

module.exports = router;
