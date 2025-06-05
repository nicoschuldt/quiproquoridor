import React, { useState } from 'react';
import MiniGameBoard from '../../components/shop/MiniGameBoard';
import type { ShopItem } from '@/types';

interface ThemePreviewCardProps {
  item: ShopItem;
  onPurchase: () => void;
  onPurchaseSuccess?: () => void; // Ajout ici ✅
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({ item, onPurchase, onPurchaseSuccess }) => {
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const isBoardTheme = item.type === 'board';
  const isPawnTheme = item.type === 'pawn';
  const pawnThemeName = isPawnTheme ? item.id.replace(/^pawn_/, '') : '';

  const handleBuyClick = async () => {
    setPurchaseMessage(null);
    try {
      await onPurchase();
      setPurchaseMessage(`✅ Achat réussi : ${item.name}`);
      
      if (onPurchaseSuccess) {
        onPurchaseSuccess(); // Mise à jour après achat ✅
      }
    } catch (error: any) {
      setPurchaseMessage(`❌ Achat échoué : ${error.message || 'Erreur inconnue'}`);
    }
  };

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
            (e.currentTarget as HTMLImageElement).src = '/images/pawns/default.png';
          }}
        />
      ) : (
        <div className="text-gray-500 py-8">Preview not available</div>
      )}

      <h3 className="mt-4 font-semibold text-center">{item.name}</h3>
      <p className="text-sm text-gray-600 text-center">{item.description}</p>
      <p className="mt-2 font-bold text-blue-600">{item.priceCoins} coins</p>

      {/* Affichage du message après achat */}
      {purchaseMessage && <p className="text-center text-red-600 mt-2">{purchaseMessage}</p>}

      <button
        className="btn btn-primary mt-4"
        onClick={handleBuyClick}
        disabled={item.owned} // Désactiver si déjà possédé
      >
        {item.owned ? 'Déjà acheté' : 'Acheter'}
      </button>
    </div>
  );
};

export default ThemePreviewCard;
