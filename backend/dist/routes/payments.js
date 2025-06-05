"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const zod_1 = require("zod");
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const errorHandler_1 = require("../middleware/errorHandler");
const config_1 = require("../config");
const router = (0, express_1.Router)();
exports.paymentsRouter = router;
// Initialize Stripe
const stripe = config_1.config.stripe.secretKey ? new stripe_1.default(config_1.config.stripe.secretKey, {
    apiVersion: '2025-05-28.basil',
}) : null;
// Coin packages configuration
const COIN_PACKAGES = [
    {
        id: 'starter',
        name: 'Starter Pack',
        coins: 500,
        priceEUR: 2.99,
        stripePriceId: config_1.config.stripe.priceIds.starter,
    },
    {
        id: 'popular',
        name: 'Popular Pack',
        coins: 1800,
        priceEUR: 9.99,
        stripePriceId: config_1.config.stripe.priceIds.popular,
        popularBadge: true,
        bonusCoins: 200, // 550 total coins
    },
    {
        id: 'pro',
        name: 'Pro Pack',
        coins: 4000,
        priceEUR: 19.99,
        stripePriceId: config_1.config.stripe.priceIds.pro,
        bonusCoins: 600, // 1400 total coins
    },
];
// Validation schemas
const createCheckoutSchema = zod_1.z.object({
    packageId: zod_1.z.string().min(1),
});
// Get available coin packages
router.get('/coin-packages', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        data: COIN_PACKAGES,
    });
}));
// Create Stripe checkout session (requires authentication)
router.post('/create-checkout-session', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!stripe) {
        throw new errorHandler_1.AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
    }
    const user = req.user;
    const { packageId } = createCheckoutSchema.parse(req.body);
    // Find the coin package
    const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
    if (!coinPackage) {
        throw new errorHandler_1.AppError(404, 'PACKAGE_NOT_FOUND', 'Coin package not found');
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
            success_url: `${config_1.config.frontendUrl}/buy-coins?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config_1.config.frontendUrl}/buy-coins?payment=cancelled`,
            client_reference_id: user.id, // Link session to user
            metadata: {
                userId: user.id,
                packageId: coinPackage.id,
                coins: (coinPackage.coins + (coinPackage.bonusCoins || 0)).toString(),
            },
        });
        if (!session.url) {
            throw new errorHandler_1.AppError(500, 'CHECKOUT_SESSION_ERROR', 'Failed to create checkout session');
        }
        res.json({
            success: true,
            data: {
                checkoutUrl: session.url,
                sessionId: session.id,
            },
        });
    }
    catch (error) {
        console.error('Stripe checkout session creation failed:', error);
        throw new errorHandler_1.AppError(500, 'STRIPE_ERROR', `Failed to create checkout session: ${error.message}`);
    }
}));
// Stripe webhook handler (raw body needed for signature verification)
router.post('/webhook', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!stripe) {
        throw new errorHandler_1.AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
    }
    const sig = req.headers['stripe-signature'];
    const webhookSecret = config_1.config.stripe.webhookSecret;
    if (!sig || !webhookSecret) {
        throw new errorHandler_1.AppError(400, 'WEBHOOK_ERROR', 'Missing stripe signature or webhook secret');
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        throw new errorHandler_1.AppError(400, 'WEBHOOK_SIGNATURE_ERROR', `Webhook Error: ${err.message}`);
    }
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object);
            break;
        case 'checkout.session.expired':
            await handleCheckoutSessionExpired(event.data.object);
            break;
        case 'payment_intent.succeeded':
            console.log('Payment succeeded:', event.data.object);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
}));
// Handle successful checkout session
async function handleCheckoutSessionCompleted(session) {
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
        await db_1.db.transaction(async (tx) => {
            // Add coins to user balance
            await tx
                .update(db_1.users)
                .set({
                coinBalance: (0, drizzle_orm_1.sql) `${db_1.users.coinBalance} + ${coinsToAdd}`
            })
                .where((0, drizzle_orm_1.eq)(db_1.users.id, userId));
            // Record the transaction
            await tx.insert(db_1.transactions).values({
                userId: userId,
                type: 'coin_purchase',
                amount: coinsToAdd,
                description: `Purchased ${coinPackage.name} - ${coinsToAdd} coins`,
                stripeSessionId: session.id,
            });
        });
        console.log(`Successfully processed coin purchase for user ${userId}: +${coinsToAdd} coins`);
    }
    catch (error) {
        console.error('Error processing checkout session completion:', error);
        // In production, you might want to implement retry logic or alert mechanisms
    }
}
// Handle expired checkout session
async function handleCheckoutSessionExpired(session) {
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
    }
    catch (error) {
        console.error('Error processing expired checkout session:', error);
    }
}
// Mock webhook endpoint for testing (development only)
if (config_1.config.nodeEnv === 'development') {
    router.post('/mock-webhook', passport_1.default.authenticate('jwt', { session: false }), (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const user = req.user;
        const { packageId } = req.body;
        // Find the coin package
        const coinPackage = COIN_PACKAGES.find(pkg => pkg.id === packageId);
        if (!coinPackage) {
            throw new errorHandler_1.AppError(404, 'PACKAGE_NOT_FOUND', 'Coin package not found');
        }
        const coinsToAdd = coinPackage.coins + (coinPackage.bonusCoins || 0);
        const mockSessionId = `mock_session_${Date.now()}_${user.id}`;
        // Simulate the webhook processing
        await db_1.db.transaction(async (tx) => {
            // Add coins to user balance
            await tx
                .update(db_1.users)
                .set({
                coinBalance: (0, drizzle_orm_1.sql) `${db_1.users.coinBalance} + ${coinsToAdd}`
            })
                .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id));
            // Record the transaction
            await tx.insert(db_1.transactions).values({
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
    }));
}
