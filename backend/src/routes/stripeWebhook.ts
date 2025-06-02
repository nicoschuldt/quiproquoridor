import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

router.post('/webhook', 
  // Stripe exige le raw body pour vérifier la signature
  express.raw({ type: 'application/json' }), 
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata.userId;
      const coins = parseInt(paymentIntent.metadata.coins, 10);

      if (userId && coins > 0) {
        await db.update(users).set({
          coins: db.raw('coins + ?', [coins]),
        }).where(eq(users.id, userId));
      }
    }

    res.json({ received: true });
  }
);

export { router as stripeWebhookRouter };