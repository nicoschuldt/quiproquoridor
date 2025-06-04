import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import Stripe from 'stripe';
import { db, users, transactions } from '../db';
import { eq, sql } from 'drizzle-orm';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { config } from '../config';
import type { CoinPackage, CreateCheckoutRequest } from '@/types';

const router = Router();

// Initialize Stripe
const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-05-28.basil',
}) : null;

// Coin packages configuration
const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    coins: 500,
    priceEUR: 2.99,
    stripePriceId: config.stripe.priceIds.starter,
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    coins: 1800,
    priceEUR: 9.99,
    stripePriceId: config.stripe.priceIds.popular,
    popularBadge: true,
    bonusCoins: 200, // 550 total coins
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    coins: 4000,
    priceEUR: 19.99,
    stripePriceId: config.stripe.priceIds.pro,
    bonusCoins: 600, // 1400 total coins
  },
];

// Validation schemas
const createCheckoutSchema = z.object({
  packageId: z.string().min(1),
});

// Get available coin packages
router.get('/coin-packages', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: COIN_PACKAGES,
  });
}));

// Create Stripe checkout session (requires authentication)
router.post('/create-checkout-session', 
  passport.authenticate('jwt', { session: false }),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!stripe) {
      throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
    }

    const user = req.user as any;
    const { packageId } = createCheckoutSchema.parse(req.body);

    // Find the coin package
    const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
    if (!coinPackage) {
      throw new AppError(404, 'PACKAGE_NOT_FOUND', 'Coin package not found');
    }

    try {
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: coinPackage.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${config.frontendUrl}/buy-coins?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/buy-coins?payment=cancelled`,
        client_reference_id: user.id, // Link session to user
        metadata: {
          userId: user.id,
          packageId: coinPackage.id,
          coins: (coinPackage.coins + (coinPackage.bonusCoins || 0)).toString(),
        },
      });

      if (!session.url) {
        throw new AppError(500, 'CHECKOUT_SESSION_ERROR', 'Failed to create checkout session');
      }

      res.json({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
        },
      });
    } catch (error: any) {
      console.error('Stripe checkout session creation failed:', error);
      throw new AppError(500, 'STRIPE_ERROR', `Failed to create checkout session: ${error.message}`);
    }
  })
);

// Stripe webhook handler (raw body needed for signature verification)
router.post('/webhook', 
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!stripe) {
      throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = config.stripe.webhookSecret;

    if (!sig || !webhookSecret) {
      throw new AppError(400, 'WEBHOOK_ERROR', 'Missing stripe signature or webhook secret');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new AppError(400, 'WEBHOOK_SIGNATURE_ERROR', `Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  })
);

// Handle successful checkout session
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const userId = session.client_reference_id;
    const packageId = session.metadata?.packageId;
    const coinsToAdd = parseInt(session.metadata?.coins || '0');

    if (!userId || !packageId || !coinsToAdd) {
      console.error('Missing required data in checkout session:', {
        userId,
        packageId,
        coinsToAdd,
        sessionId: session.id,
      });
      return;
    }

    // Find the coin package for description
    const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
    if (!coinPackage) {
      console.error('Coin package not found:', packageId);
      return;
    }

    // Perform atomic transaction to add coins and record transaction
    await db.transaction(async (tx) => {
      // Add coins to user balance
      await tx
        .update(users)
        .set({ 
          coinBalance: sql`${users.coinBalance} + ${coinsToAdd}` 
        })
        .where(eq(users.id, userId));

      // Record the transaction
      await tx.insert(transactions).values({
        userId: userId,
        type: 'coin_purchase',
        amount: coinsToAdd,
        description: `Purchased ${coinPackage.name} - ${coinsToAdd} coins`,
        stripeSessionId: session.id,
      });
    });

    console.log(`Successfully processed coin purchase for user ${userId}: +${coinsToAdd} coins`);
  } catch (error) {
    console.error('Error processing checkout session completion:', error);
    // In production, you might want to implement retry logic or alert mechanisms
  }
}

// Handle expired checkout session
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const userId = session.client_reference_id;
    const packageId = session.metadata?.packageId;

    if (!userId || !packageId) {
      console.error('Missing required data in expired checkout session:', {
        userId,
        packageId,
        sessionId: session.id,
      });
      return;
    }

    // Find the coin package for logging
    const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
    if (!coinPackage) {
      console.error('Coin package not found:', packageId);
      return;
    }

    // Just log the expiration - no financial transaction needed
    // since the user never completed the payment
    console.log(`Checkout session expired for user ${userId}: ${coinPackage.name} (${coinPackage.coins + (coinPackage.bonusCoins || 0)} coins), session: ${session.id}`);
    
    // In production, you might want to:
    // - Send an email reminder to the user
    // - Track abandonment analytics
    // - Trigger remarketing campaigns
    
  } catch (error) {
    console.error('Error processing expired checkout session:', error);
  }
}

// Mock webhook endpoint for testing (development only)
if (config.nodeEnv === 'development') {
  router.post('/mock-webhook',
    passport.authenticate('jwt', { session: false }),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const user = req.user as any;
      const { packageId } = req.body;

      // Find the coin package
      const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
      if (!coinPackage) {
        throw new AppError(404, 'PACKAGE_NOT_FOUND', 'Coin package not found');
      }

      const coinsToAdd = coinPackage.coins + (coinPackage.bonusCoins || 0);
      const mockSessionId = `mock_session_${Date.now()}_${user.id}`;

      // Simulate the webhook processing
      await db.transaction(async (tx) => {
        // Add coins to user balance
        await tx
          .update(users)
          .set({ 
            coinBalance: sql`${users.coinBalance} + ${coinsToAdd}` 
          })
          .where(eq(users.id, user.id));

        // Record the transaction
        await tx.insert(transactions).values({
          userId: user.id,
          type: 'coin_purchase',
          amount: coinsToAdd,
          description: `[MOCK] Purchased ${coinPackage.name} - ${coinsToAdd} coins`,
          stripeSessionId: mockSessionId,
        });
      });

      res.json({
        success: true,
        data: {
          message: `Mock purchase successful: +${coinsToAdd} coins`,
          coinsAdded: coinsToAdd,
          sessionId: mockSessionId,
        },
      });
    })
  );
}

export { router as paymentsRouter }; 