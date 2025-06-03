import type { Player, PlayerColor } from '@/types';

/**
 * Get CSS classes for a player's pawn based on their theme and color
 * @param player - The player object containing theme information
 * @returns Combined CSS class string for the pawn
 */
export const getPawnClasses = (player: Player): string => {
  const theme = player.selectedPawnTheme || 'default';
  const color = `color-${player.color}`;
  return `${theme} ${color}`;
};

/**
 * Get fallback CSS classes for a pawn when theme data is missing
 * @param color - The player color
 * @returns Fallback CSS class string
 */
export const getFallbackPawnClasses = (color: PlayerColor): string => {
  return `theme-pawn-default color-${color}`;
};

/**
 * Get safe CSS classes for a pawn with fallback
 * @param player - The player object
 * @returns Safe CSS class string with fallback
 */
export const getSafePawnClasses = (player: Player): string => {
  try {
    return getPawnClasses(player);
  } catch (error) {
    console.warn('Failed to get pawn classes, using fallback:', error);
    return getFallbackPawnClasses(player.color);
  }
};

/**
 * Validate if a pawn theme CSS class is valid
 * @param themeClass - The theme CSS class
 * @returns Boolean indicating if theme is valid
 */
export const isValidPawnTheme = (themeClass: string): boolean => {
  const validThemes = [
    'default',
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
    'theme-board-forest',
    'theme-board-ocean',
    'theme-board-neon',
    'theme-board-desert'
  ];
  return validThemes.includes(themeClass);
}; 