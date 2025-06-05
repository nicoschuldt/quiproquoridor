import type { Player, PlayerColor } from '@/types';

const getThemeNameFromClass = (themeClass: string): string => {
  return themeClass.replace('theme-pawn-', '');
};

export const getPawnImagePath = (player: Player): string => {
  const themeClass = player.selectedPawnTheme || 'theme-pawn-default';
  const themeName = getThemeNameFromClass(themeClass);
  const color = player.color;
  return `/images/pawns/${themeName}/${color}.png`;
};

export const getFallbackPawnImagePath = (color: PlayerColor): string => {
  return `/images/pawns/default/${color}.png`;
};

export const getSafePawnImagePath = (player: Player): string => {
  try {
    return getPawnImagePath(player);
  } catch (error) {
    console.warn('Failed to get pawn image path, using fallback:', error);
    return getFallbackPawnImagePath(player.color);
  }
};

export const getSafePawnClasses = (player: Player): string => {
  return 'pawn-image';
};

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

export const getBoardThemeClass = (selectedBoardTheme?: string): string => {
  if (!selectedBoardTheme || !isValidBoardTheme(selectedBoardTheme)) {
    return '';
  }
  return selectedBoardTheme;
};

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