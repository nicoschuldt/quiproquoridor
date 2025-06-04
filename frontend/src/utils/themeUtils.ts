import type { Player, PlayerColor } from '@/types';

/**
 * Get the theme name from CSS class (remove "theme-pawn-" prefix)
 * @param themeClass - CSS class like "theme-pawn-knights"
 * @returns Theme name like "knights"
 */
const getThemeNameFromClass = (themeClass: string): string => {
  return themeClass.replace('theme-pawn-', '');
};

/**
 * Get image path for a player's pawn based on their theme and color
 * @param player - The player object containing theme information
 * @returns Image path for the pawn
 */
export const getPawnImagePath = (player: Player): string => {
  const themeClass = player.selectedPawnTheme || 'theme-pawn-default';
  const themeName = getThemeNameFromClass(themeClass);
  const color = player.color;
  return `/images/pawns/${themeName}/${color}.png`;
};

/**
 * Get fallback image path for a pawn when theme data is missing
 * @param color - The player color
 * @returns Fallback image path
 */
export const getFallbackPawnImagePath = (color: PlayerColor): string => {
  return `/images/pawns/default/${color}.png`;
};

/**
 * Get safe image path for a pawn with fallback
 * @param player - The player object
 * @returns Safe image path with fallback
 */
export const getSafePawnImagePath = (player: Player): string => {
  try {
    return getPawnImagePath(player);
  } catch (error) {
    console.warn('Failed to get pawn image path, using fallback:', error);
    return getFallbackPawnImagePath(player.color);
  }
};

/**
 * @deprecated Use getSafePawnImagePath instead. This function is kept for compatibility
 * but now returns basic CSS classes for the pawn container
 * @param player - The player object
 * @returns Basic CSS classes for pawn container
 */
export const getSafePawnClasses = (player: Player): string => {
  // Return basic container classes for positioning and sizing
  return 'pawn-image';
};

/**
 * Validate if a pawn theme CSS class is valid
 * @param themeClass - The theme CSS class
 * @returns Boolean indicating if theme is valid
 */
export const isValidPawnTheme = (themeClass: string): boolean => {
  const validThemes = [
    'theme-pawn-default',
    'theme-pawn-knights',
    'theme-pawn-robots',
    'theme-pawn-animals',
    'theme-pawn-gems'
  ];
  return validThemes.includes(themeClass);
};

/**
 * Get CSS class for board theme
 * @param selectedBoardTheme - The user's selected board theme
 * @returns Board theme CSS class with fallback
 */
export const getBoardThemeClass = (selectedBoardTheme?: string): string => {
  if (!selectedBoardTheme || !isValidBoardTheme(selectedBoardTheme)) {
    return ''; // No theme class = default styling
  }
  return selectedBoardTheme;
};

/**
 * Validate if a board theme CSS class is valid
 * @param themeClass - The theme CSS class
 * @returns Boolean indicating if theme is valid
 */
export const isValidBoardTheme = (themeClass: string): boolean => {
  const validThemes = [
    'theme-board-default',
    'theme-board-forest',
    'theme-board-ocean',
    'theme-board-neon',
    'theme-board-desert'
  ];
  return validThemes.includes(themeClass);
}; 