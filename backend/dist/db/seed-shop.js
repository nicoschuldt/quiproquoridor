"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_SHOP_ITEMS = void 0;
exports.seedShopItems = seedShopItems;
exports.resetShopItems = resetShopItems;
const index_1 = require("./index");
const schema_1 = require("./schema");
exports.INITIAL_SHOP_ITEMS = [
    // Board Themes
    {
        id: 'board_forest',
        name: 'Forest Theme',
        description: 'Mystical forest themed board with wooden textures',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-forest',
        previewImageUrl: '/images/themes/forest-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_ocean',
        name: 'Ocean Theme',
        description: 'Deep blue ocean board with water effects',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-ocean',
        previewImageUrl: '/images/themes/ocean-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_neon',
        name: 'Neon Theme',
        description: 'Cyberpunk neon board with glowing effects',
        type: 'board',
        priceCoins: 125,
        cssClass: 'theme-board-neon',
        previewImageUrl: '/images/themes/neon-preview.jpg',
        isActive: true,
    },
    {
        id: 'board_desert',
        name: 'Desert Theme',
        description: 'Sandy desert board with ancient stone textures',
        type: 'board',
        priceCoins: 100,
        cssClass: 'theme-board-desert',
        previewImageUrl: '/images/themes/desert-preview.jpg',
        isActive: true,
    },
    // Pawn Themes
    {
        id: 'pawn_knights',
        name: 'Medieval Knights',
        description: 'Castle and knight pieces with heraldic designs',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-knights',
        previewImageUrl: '/images/themes/knights-preview.jpg',
        isActive: true,
    },
    {
        id: 'pawn_robots',
        name: 'Future Robots',
        description: 'Sci-fi robot pieces with metallic finish',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-robots',
        previewImageUrl: '/images/themes/robots-preview.jpg',
        isActive: true,
    },
    {
        id: 'pawn_animals',
        name: 'Animal Kingdom',
        description: 'Cute animal pieces with different species per color',
        type: 'pawn',
        priceCoins: 75,
        cssClass: 'theme-pawn-animals',
        previewImageUrl: '/images/themes/animals-preview.jpg',
        isActive: true,
    },
    {
        id: 'pawn_gems',
        name: 'Precious Gems',
        description: 'Sparkling gem pieces with crystal effects',
        type: 'pawn',
        priceCoins: 90,
        cssClass: 'theme-pawn-gems',
        previewImageUrl: '/images/themes/gems-preview.jpg',
        isActive: true,
    },
];
/**
 * Seeds the shop_items table with initial themes
 * Can be run multiple times safely (uses INSERT OR IGNORE)
 */
async function seedShopItems() {
    try {
        console.log('🌱 Seeding shop items...');
        for (const item of exports.INITIAL_SHOP_ITEMS) {
            await index_1.db.insert(schema_1.shopItems)
                .values(item)
                .onConflictDoNothing(); // SQLite equivalent of "INSERT OR IGNORE"
        }
        console.log(`✅ Successfully seeded ${exports.INITIAL_SHOP_ITEMS.length} shop items`);
    }
    catch (error) {
        console.error('❌ Error seeding shop items:', error);
        throw error;
    }
}
/**
 * Utility function to reset shop items (useful for development)
 */
async function resetShopItems() {
    try {
        console.log('🔄 Resetting shop items...');
        // Delete all shop items
        await index_1.db.delete(schema_1.shopItems);
        // Re-seed
        await seedShopItems();
        console.log('✅ Shop items reset successfully');
    }
    catch (error) {
        console.error('❌ Error resetting shop items:', error);
        throw error;
    }
}
