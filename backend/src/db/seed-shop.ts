import { db } from './index';
import { shopItems } from './schema';
import type { NewShopItem } from './schema';

export const INITIAL_SHOP_ITEMS: NewShopItem[] = [
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

export async function seedShopItems(): Promise<void> {
  try {
    console.log('Seeding shop items...');
    
    for (const item of INITIAL_SHOP_ITEMS) {
      await db.insert(shopItems)
        .values(item)
        .onConflictDoNothing();
    }
    
    console.log(`Successfully seeded ${INITIAL_SHOP_ITEMS.length} shop items`);
  } catch (error) {
    console.error('Error seeding shop items:', error);
    throw error;
  }
}

export async function resetShopItems(): Promise<void> {
  try {
    console.log('Resetting shop items...');
    await db.delete(shopItems);
    await seedShopItems();
    console.log('Shop items reset successfully');
  } catch (error) {
    console.error('Error resetting shop items:', error);
    throw error;
  }
} 