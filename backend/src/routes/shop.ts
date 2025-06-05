import { Router, Request, Response } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { db, users, shopItems, userPurchases, transactions } from '../db';
import { eq, and, notInArray } from 'drizzle-orm';
import { asyncHandler, AppError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(passport.authenticate('jwt', { session: false }));

// Validation schemas
const purchaseThemeSchema = z.object({
  shopItemId: z.string().min(1),
});

const selectThemeSchema = z.object({
  themeType: z.enum(['board', 'pawn']),
  cssClass: z.string().min(1),
});

// Get all shop data for user (owned themes, available themes, balance, selected themes)
router.get('/data', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;

  // Get user data with current balance and selected themes
  const userData = await db
    .select({
      coinBalance: users.coinBalance,
      selectedBoardTheme: users.selectedBoardTheme,
      selectedPawnTheme: users.selectedPawnTheme,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (userData.length === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const { coinBalance, selectedBoardTheme, selectedPawnTheme } = userData[0];

  // Get all active shop items
  const allShopItems = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.isActive, true));

  // Get user's owned themes
  const ownedThemeIds = await db
    .select({
      shopItemId: userPurchases.shopItemId,
    })
    .from(userPurchases)
    .where(eq(userPurchases.userId, user.id));

  const ownedIds = new Set(ownedThemeIds.map(p => p.shopItemId));

  // Separate owned and available themes
  const owned = allShopItems.filter(item => ownedIds.has(item.id));
  const available = allShopItems.filter(item => !ownedIds.has(item.id));


  res.json({
    success: true,
    data: {
      available,
      owned,
      selected: {
        selectedBoardTheme,
        selectedPawnTheme,
      },
      coinBalance,
    },
  });
}));

// Purchase a theme
router.post('/purchase', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { shopItemId } = purchaseThemeSchema.parse(req.body);
console.log('Tentative d’achat avec ShopItem ID:', shopItemId);

  // Get theme details
  const themeResult = await db
    .select()
    .from(shopItems)
    .where(and(
      eq(shopItems.id, shopItemId),
      eq(shopItems.isActive, true)
    ))
    .limit(1);
console.log('Résultat de la recherche du thème:', themeResult);
  if (themeResult.length === 0) {
    throw new AppError(404, 'THEME_NOT_FOUND', 'Theme not found or not available');
  }

  const theme = themeResult[0];
console.log('Thème récupéré:', theme);
  // Check if user already owns this theme
  const existingPurchase = await db
    .select()
    .from(userPurchases)
    .where(and(
      eq(userPurchases.userId, user.id),
      eq(userPurchases.shopItemId, shopItemId)
    ))
    .limit(1);

  if (existingPurchase.length > 0) {
    throw new AppError(400, 'ALREADY_OWNED', 'You already own this theme');
  }

  // Get user's current balance
  const userResult = await db
    .select({
      coinBalance: users.coinBalance,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (userResult.length === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const currentBalance = userResult[0].coinBalance;

  // Check if user has sufficient funds
  if (currentBalance < theme.priceCoins) {
    throw new AppError(400, 'INSUFFICIENT_FUNDS', 
      `Insufficient coins. You have ${currentBalance}, need ${theme.priceCoins}`);
  }

  const newBalance = currentBalance - theme.priceCoins;

  // Execute purchase transaction atomically
  await db.transaction(async (tx) => {
    // Deduct coins from user
    await tx
      .update(users)
      .set({ coinBalance: newBalance })
      .where(eq(users.id, user.id));

    // Record the purchase
    await tx.insert(userPurchases).values({
      userId: user.id,
      shopItemId: shopItemId,
    });

    // Record the transaction for audit trail
    await tx.insert(transactions).values({
      userId: user.id,
      type: 'theme_purchase',
      amount: -theme.priceCoins,
      description: `Purchased ${theme.name}`,
      shopItemId: shopItemId,
    });
  });

  res.json({
    success: true,
    data: {
      success: true,
      newBalance,
      purchasedItem: theme,
    },
    message: `Successfully purchased ${theme.name}`,
  });
}));

// Select/change active theme
router.post('/select-theme', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user as any;
  const { themeType, cssClass } = selectThemeSchema.parse(req.body);

  if (cssClass === 'theme-board-default' || cssClass === 'theme-pawn-default') {
    const updateField = themeType === 'board' ? 'selectedBoardTheme' : 'selectedPawnTheme';
    
    await db
      .update(users)
      .set({ [updateField]: cssClass })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      message: `Selected default ${themeType} theme`,
    });
    return;
  }

  // For non-default themes, verify ownership
  // First, find the theme by CSS class and type
  const themeResult = await db
    .select()
    .from(shopItems)
    .where(and(
      eq(shopItems.cssClass, cssClass),
      eq(shopItems.type, themeType),
      eq(shopItems.isActive, true)
    ))
    .limit(1);

  if (themeResult.length === 0) {
    throw new AppError(404, 'THEME_NOT_FOUND', 'Theme not found');
  }

  const theme = themeResult[0];

  // Check if user owns this theme
  const ownership = await db
    .select()
    .from(userPurchases)
    .where(and(
      eq(userPurchases.userId, user.id),
      eq(userPurchases.shopItemId, theme.id)
    ))
    .limit(1);

  if (ownership.length === 0) {
    throw new AppError(403, 'NOT_OWNED', 'You do not own this theme');
  }

  // Update user's selected theme
  const updateField = themeType === 'board' ? 'selectedBoardTheme' : 'selectedPawnTheme';
  
  await db
    .update(users)
    .set({ [updateField]: cssClass })
    .where(eq(users.id, user.id));

  res.json({
    success: true,
    message: `Selected ${theme.name} as active ${themeType} theme`,
  });
}));

export { router as shopRouter }; 