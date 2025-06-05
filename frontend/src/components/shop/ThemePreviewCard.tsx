import React from 'react';
import MiniGameBoard from '../../components/shop/MiniGameBoard';
import type { ShopItem } from '@/types';

interface ThemePreviewCardProps {
  item: ShopItem;
  onPurchaseSuccess?: () => void;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({ item, onPurchaseSuccess }) => {
  const isBoardTheme = item.type === 'board';
  const isPawnTheme = item.type === 'pawn';

  // Extraction du thème pour chemin image pawn : 'pawn_knights' → 'knights'
  const pawnThemeName = isPawnTheme ? item.id.replace(/^pawn_/, '') : '';

  return (
    <div className="card p-4 shadow rounded-lg max-w-sm flex flex-col items-center">
      {isBoardTheme ? (
        <MiniGameBoard boardThemeClass={item.cssClass} />
      ) : isPawnTheme ? (
        <img
          src={`/images/pawns/${pawnThemeName}/all.png`}
          alt={`${item.name} preview`}
          className="w-full h-auto object-contain"
          onError={(e) => {
            // Fallback si image manquante
            (e.currentTarget as HTMLImageElement).src = '/images/pawns/default.png';
          }}
        />
      ) : (
        <div className="text-gray-500 py-8">Preview not available</div>
      )}

      <h3 className="mt-4 font-semibold text-center">{item.name}</h3>
      <p className="text-sm text-gray-600 text-center">{item.description}</p>
      <p className="mt-2 font-bold text-blue-600">{item.priceCoins} coins</p>

      <button
        className="btn btn-primary mt-4"
        onClick={() => {
          // Ici ta logique d'achat avec onPurchaseSuccess si besoin
          if (onPurchaseSuccess) onPurchaseSuccess();
        }}
      >
        Buy
      </button>
    </div>
  );
};

export default ThemePreviewCard;
