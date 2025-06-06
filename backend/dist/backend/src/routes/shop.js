"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopRouter = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const zod_1 = require("zod");
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
exports.shopRouter = router;
router.use(passport_1.default.authenticate('jwt', { session: false }));
const purchaseThemeSchema = zod_1.z.object({
    shopItemId: zod_1.z.string().min(1),
});
const selectThemeSchema = zod_1.z.object({
    themeType: zod_1.z.enum(['board', 'pawn']),
    cssClass: zod_1.z.string().min(1),
});
router.get('/data', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const userData = await db_1.db
        .select({
        coinBalance: db_1.users.coinBalance,
        selectedBoardTheme: db_1.users.selectedBoardTheme,
        selectedPawnTheme: db_1.users.selectedPawnTheme,
    })
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id))
        .limit(1);
    if (userData.length === 0) {
        throw new errorHandler_1.AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const { coinBalance, selectedBoardTheme, selectedPawnTheme } = userData[0];
    const allShopItems = await db_1.db
        .select()
        .from(db_1.shopItems)
        .where((0, drizzle_orm_1.eq)(db_1.shopItems.isActive, true));
    const ownedThemeIds = await db_1.db
        .select({
        shopItemId: db_1.userPurchases.shopItemId,
    })
        .from(db_1.userPurchases)
        .where((0, drizzle_orm_1.eq)(db_1.userPurchases.userId, user.id));
    const ownedIds = new Set(ownedThemeIds.map(p => p.shopItemId));
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
router.post('/purchase', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { shopItemId } = purchaseThemeSchema.parse(req.body);
    console.log('Tentative d’achat avec ShopItem ID:', shopItemId);
    const themeResult = await db_1.db
        .select()
        .from(db_1.shopItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.shopItems.id, shopItemId), (0, drizzle_orm_1.eq)(db_1.shopItems.isActive, true)))
        .limit(1);
    console.log('Résultat de la recherche du thème:', themeResult);
    if (themeResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'THEME_NOT_FOUND', 'Theme not found or not available');
    }
    const theme = themeResult[0];
    console.log('Thème récupéré:', theme);
    const existingPurchase = await db_1.db
        .select()
        .from(db_1.userPurchases)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.userPurchases.userId, user.id), (0, drizzle_orm_1.eq)(db_1.userPurchases.shopItemId, shopItemId)))
        .limit(1);
    if (existingPurchase.length > 0) {
        throw new errorHandler_1.AppError(400, 'ALREADY_OWNED', 'You already own this theme');
    }
    const userResult = await db_1.db
        .select({
        coinBalance: db_1.users.coinBalance,
    })
        .from(db_1.users)
        .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id))
        .limit(1);
    if (userResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const currentBalance = userResult[0].coinBalance;
    if (currentBalance < theme.priceCoins) {
        throw new errorHandler_1.AppError(400, 'INSUFFICIENT_FUNDS', `Insufficient coins. You have ${currentBalance}, need ${theme.priceCoins}`);
    }
    const newBalance = currentBalance - theme.priceCoins;
    await db_1.db.transaction(async (tx) => {
        await tx
            .update(db_1.users)
            .set({ coinBalance: newBalance })
            .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id));
        await tx.insert(db_1.userPurchases).values({
            userId: user.id,
            shopItemId: shopItemId,
        });
        await tx.insert(db_1.transactions).values({
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
            previewImageUrl: theme.previewImageUrl || '/images/pawns/default.png', // Ajout ici 
        },
        message: `Successfully purchased ${theme.name}`,
    });
}));
router.post('/select-theme', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { themeType, cssClass } = selectThemeSchema.parse(req.body);
    if (cssClass === 'theme-board-default' || cssClass === 'theme-pawn-default') {
        const updateField = themeType === 'board' ? 'selectedBoardTheme' : 'selectedPawnTheme';
        await db_1.db
            .update(db_1.users)
            .set({ [updateField]: cssClass })
            .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id));
        res.json({
            success: true,
            message: `Selected default ${themeType} theme`,
        });
        return;
    }
    const themeResult = await db_1.db
        .select()
        .from(db_1.shopItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.shopItems.cssClass, cssClass), (0, drizzle_orm_1.eq)(db_1.shopItems.type, themeType), (0, drizzle_orm_1.eq)(db_1.shopItems.isActive, true)))
        .limit(1);
    if (themeResult.length === 0) {
        throw new errorHandler_1.AppError(404, 'THEME_NOT_FOUND', 'Theme not found');
    }
    const theme = themeResult[0];
    const ownership = await db_1.db
        .select()
        .from(db_1.userPurchases)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.userPurchases.userId, user.id), (0, drizzle_orm_1.eq)(db_1.userPurchases.shopItemId, theme.id)))
        .limit(1);
    if (ownership.length === 0) {
        throw new errorHandler_1.AppError(403, 'NOT_OWNED', 'You do not own this theme');
    }
    const updateField = themeType === 'board' ? 'selectedBoardTheme' : 'selectedPawnTheme';
    await db_1.db
        .update(db_1.users)
        .set({ [updateField]: cssClass })
        .where((0, drizzle_orm_1.eq)(db_1.users.id, user.id));
    res.json({
        success: true,
        message: `Selected ${theme.name} as active ${themeType} theme`,
    });
}));
