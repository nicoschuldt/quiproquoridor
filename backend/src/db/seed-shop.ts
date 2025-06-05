import { db } from './index';
import { shopItems } from './schema';
import type { NewShopItem } from './schema';

export const INITIAL_SHOP_ITEMS: NewShopItem[] = [
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

  {
    id: 'pawn_knights',
    name: 'Medieval Knights',
    description: 'Castle and knight pieces with heraldic designs',
    type: 'pawn',
    priceCoins: 75,
    cssClass: 'theme-pawn-knights',
    previewImageUrl: '/images/pawns/knights/all.png',
    isActive: true,
  },
  {
    id: 'pawn_robots',
    name: 'Future Robots',
    description: 'Sci-fi robot pieces with metallic finish',
    type: 'pawn',
    priceCoins: 75,
    cssClass: 'theme-pawn-robots',
    previewImageUrl: '/images/pawns/robots/all.png',
    isActive: true,
  },
  {
    id: 'pawn_animals',
    name: 'Animal Kingdom',
    description: 'Cute animal pieces with different species per color',
    type: 'pawn',
    priceCoins: 75,
    cssClass: 'theme-pawn-animals',
    previewImageUrl: '/images/pawns/animals/all.png',
    isActive: true,
  },
  {
    id: 'pawn_gems',
    name: 'Precious Gems',
    description: 'Sparkling gem pieces with crystal effects',
    type: 'pawn',
    priceCoins: 90,
    cssClass: 'theme-pawn-gems',
    previewImageUrl: '/images/pawns/gems/all.png',
    isActive: true,
  },
  {
    id: 'pawn_frogs',
    name: 'Frogs',
    description: 'Frogs',
    type: 'pawn',
    priceCoins: 60,
    cssClass: 'theme-pawn-frogs',
    previewImageUrl: '/images/pawns/frogs/all.png',
    isActive: true,
  },
];

export async function seedShopItems(): Promise<void> {
  try {
    console.log('🌱 Seeding shop items...');
    
    for (const item of INITIAL_SHOP_ITEMS) {
      await db.insert(shopItems)
        .values(item)
        .onConflictDoNothing();
    }
    
    console.log(`✅ Successfully seeded ${INITIAL_SHOP_ITEMS.length} shop items`);
  } catch (error) {
    console.error('❌ Error seeding shop items:', error);
    throw error;
  }
}

export async function resetShopItems(): Promise<void> {
  try {
    console.log('🔄 Resetting shop items...');
    await db.delete(shopItems);
    await seedShopItems();
    console.log('✅ Shop items reset successfully');
  } catch (error) {
    console.error('❌ Error resetting shop items:', error);
    throw error;
  }
} 