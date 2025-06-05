import React, { useState } from 'react';
import MiniGameBoard from '../../components/shop/MiniGameBoard';
import type { ShopItem } from '@/types';

interface ThemePreviewCardProps {
  item: ShopItem;
  mode: 'purchase' | 'select';
  onPurchase?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({
  item,
  mode,
  onPurchase,
  onSelect,
  selected = false,
  disabled = false,
}) => {
  const [message, setMessage] = useState<string | null>(null);

  const isBoardTheme = item.type === 'board';
  const isPawnTheme = item.type === 'pawn';
  const pawnThemeName = isPawnTheme ? item.id.replace(/^pawn_/, '') : '';

  // Handles purchase
  const handleBuyClick = async () => {
    if (!item.owned && onPurchase) {
      try {
        await onPurchase();
        setMessage(`✅ Achat réussi : ${item.name}`);
      } catch (error: any) {
        setMessage(`❌ Achat échoué : ${error.message || 'Erreur inconnue'}`);
      }
    }
  };

  // Handles selection
  const handleSelectClick = async () => {
    if (item.owned && onSelect) {
      try {
        await onSelect();
        setMessage(`✅ Sélectionné : ${item.name}`);
      } catch (error: any) {
        setMessage(`❌ Sélection échouée : ${error.message || 'Erreur inconnue'}`);
      }
    }
  };

  return (
    <div className="card p-4 shadow rounded-lg max-w-sm flex flex-col items-center relative">
      {/* Selected badge for board themes */}
      {selected && isBoardTheme && (
        <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow z-10 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Sélectionné
        </span>
      )}
      {isBoardTheme ? (
        <MiniGameBoard boardThemeClass={item.cssClass} />
      ) : isPawnTheme ? (
        <img
          src={`/images/pawns/${pawnThemeName}/all.png`}
          alt={`${item.name} preview`}
          className="w-full h-auto object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/images/pawns/default.png';
          }}
        />
      ) : (
        <div className="text-gray-500 py-8">Preview not available</div>
      )}

      <h3 className="mt-4 font-semibold text-center">{item.name}</h3>
      <p className="text-sm text-gray-600 text-center">{item.description}</p>
      <p className="mt-2 font-bold text-blue-600">{item.priceCoins} coins</p>

      {/* Affichage du message après action */}
      {message && <p className={`text-center mt-2 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

      {/* Button logic */}
      {mode === 'purchase' && !item.owned && (
        <button className="btn btn-primary mt-4" onClick={handleBuyClick} disabled={disabled}>
          Acheter
        </button>
      )}
      {mode === 'select' && item.owned && !selected && (
        <button className="btn btn-primary mt-4" onClick={handleSelectClick} disabled={disabled}>
          Sélectionner
        </button>
      )}
      {mode === 'select' && item.owned && selected && (
        <button className="btn btn-primary mt-4" disabled>
          Sélectionné
        </button>
      )}
      {mode === 'purchase' && item.owned && (
        <button className="btn btn-primary mt-4" disabled>
          Déjà acheté
        </button>
      )}
    </div>
  );
};

export default ThemePreviewCard;
