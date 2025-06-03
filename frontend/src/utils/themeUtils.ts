import type { Player, PlayerColor } from '@/types';

/**
 * Get CSS classes for a player's pawn based on their theme and color
 * @param player - The player object containing theme information
 * @returns Combined CSS class string for the pawn
 */
export const getPawnClasses = (player: Player): string => {
  const theme = player.selectedPawnTheme || 'theme-pawn-default';
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
 * Validate if a pawn theme CSS class is valid
 * @param themeClass - The theme CSS class to validate
 * @returns Whether the theme class is valid
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
 * Get safe pawn CSS classes with validation and fallback
 * @param player - The player object
 * @returns Safe CSS class string with fallback
 */
export const getSafePawnClasses = (player: Player): string => {
  const theme = player.selectedPawnTheme && isValidPawnTheme(player.selectedPawnTheme)
    ? player.selectedPawnTheme
    : 'theme-pawn-default';
  
  const color = `color-${player.color}`;
  return `${theme} ${color}`;
}; 