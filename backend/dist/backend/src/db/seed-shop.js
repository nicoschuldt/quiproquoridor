"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_SHOP_ITEMS = void 0;
exports.seedShopItems = seedShopItems;
exports.resetShopItems = resetShopItems;
const index_1 = require("./index");
const schema_1 = require("./schema");
exports.INITIAL_SHOP_ITEMS = [
    {
        id: 'board_forest',
        name: 'Forêt',
        description: 'Theme de forêt',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-forest',
        previewImageUrl: '/images/themes/forest-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_ocean',
        name: 'Océan',
        description: 'Theme de l\'océan',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-ocean',
        previewImageUrl: '/images/themes/ocean-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_neon',
        name: 'Neon',
        description: 'Theme cyberpunk',
        type: 'board',
        priceCoins: 125,
        cssClass: 'theme-board-neon',
        previewImageUrl: '/images/themes/neon-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_desert',
        name: 'Désert',
        description: 'Theme de désert',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-desert',
        previewImageUrl: '/images/themes/desert-preview.jpg',
        isActive: true,
    },
    {
        id: 'pawn_knights',
        name: 'Chevaliers médiévaux',
        description: 'Chevaliers médiévaux',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-knights',
        previewImageUrl: '/images/pawns/knights/all.png',
        isActive: true,
    },
    {
        id: 'pawn_robots',
        name: 'Robots',
        description: 'Robots',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-robots',
        previewImageUrl: '/images/pawns/robots/all.png',
        isActive: true,
    },
    {
        id: 'pawn_animals',
        name: 'Oiseaux',
        description: 'Oiseaux de toutes les couleurs',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-animals',
        previewImageUrl: '/images/pawns/animals/all.png',
        isActive: true,
    },
    {
        id: 'pawn_gems',
        name: 'Minéraux',
        description: 'Minéraux',
        type: 'pawn',
        priceCoins: 90,
        cssClass: 'theme-pawn-gems',
        previewImageUrl: '/images/pawns/gems/all.png',
        isActive: true,
    },
    {
        id: 'pawn_frogs',
        name: 'Grenouilles',
        description: 'Grenouilles',
        type: 'pawn',
        priceCoins: 60,
        cssClass: 'theme-pawn-frogs',
        previewImageUrl: '/images/pawns/frogs/all.png',
        isActive: true,
    },
];
async function seedShopItems() {
    try {
        console.log('Seeding shop items...');
        for (const item of exports.INITIAL_SHOP_ITEMS) {
            await index_1.db.insert(schema_1.shopItems)
                .values(item)
                .onConflictDoNothing();
        }
        console.log(`Successfully seeded ${exports.INITIAL_SHOP_ITEMS.length} shop items`);
    }
    catch (error) {
        console.error('Error seeding shop items:', error);
        throw error;
    }
}
async function resetShopItems() {
    try {
        console.log('Resetting shop items...');
        await index_1.db.delete(schema_1.shopItems);
        await seedShopItems();
        console.log('Shop items reset successfully');
    }
    catch (error) {
        console.error('Error resetting shop items:', error);
        throw error;
    }
}
