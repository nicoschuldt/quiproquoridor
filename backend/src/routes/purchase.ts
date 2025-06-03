import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import passport from 'passport';
import { PurchaseCoinsRequest, PurchaseCoinsResponse } from '../../../shared/types';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

interface AuthenticatedUser {
  id: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

router.post(
  '/create-payment-intent',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    const { amount, coins } = req.body as PurchaseCoinsRequest;
    // Vérifie que req.user existe et a un id
    if (!amount || !coins || !req.user?.id) {
      return res.status(400).json({ error: 'Invalid request or user not authenticated' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        userId: req.user.id,
        coins: coins.toString(),
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret } as PurchaseCoinsResponse);
  }
);

export { router as purchaseRouter };