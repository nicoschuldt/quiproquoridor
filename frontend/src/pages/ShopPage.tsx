import React, { useEffect, useState } from 'react';
import ThemePreviewCard from '../components/shop/ThemePreviewCard';
import PageLayout from '../components/PageLayout';
import { shopApi } from '../services/api';
import type { ShopItem } from '@/types';

const ShopPage: React.FC = () => {
  const [themes, setThemes] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [selectedPawn, setSelectedPawn] = useState<string | null>(null);

  const loadThemes = async () => {
    setLoading(true);
    setError(null);
    setPurchaseMessage(null);
    try {
      const data = await shopApi.getShopData();
      const allThemes = [...data.available, ...data.owned.map(t => ({ ...t, owned: true }))];
      setThemes(allThemes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error loading shop');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  const handleSelectCosmetic = async (themeType: 'board' | 'pawn', cosmeticId: string) => {
    if (themeType === 'board') {
      setSelectedBoard(cosmeticId);
    } else {
      setSelectedPawn(cosmeticId);
    }

    try {
      await shopApi.selectTheme(themeType, cosmeticId);
      // pour refresh les styles css
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de la sélection du cosmétique:", error);
    }
  };

  const handlePurchase = async (shopItemId: string) => {
    setPurchaseMessage(null);
    try {
      setLoading(true);
      const response = await shopApi.purchaseTheme(shopItemId);

      if (response.success && response.purchasedItem) {
        setPurchaseMessage(`Achat réussi : ${response.purchasedItem.name}`);

        setThemes(prevThemes =>
          prevThemes.map(theme =>
            theme.id === shopItemId ? { ...theme, owned: true, previewImageUrl: response.purchasedItem.previewImageUrl || "/images/pawns/default.png" } : theme
          )
        );
        
        // pour refresh les coins
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setPurchaseMessage(`Achat échoué : ${response.message || 'Donnée manquante dans la réponse'}`);
      }
    } catch (err: any) {
      setPurchaseMessage(`Erreur d'achat : ${err.message || 'Échec inconnu'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Pawn Theme Previews" showBackButton>
      <div className="text-center mb-8 mt-6 max-w-4xl mx-auto px-4">
        <div className="text-6xl mb-2">🎨</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-1">Shop</h1>
        <p className="text-lg text-gray-600 mb-4">
        Choisissez votre style de pion et de plateau préféré ci-dessous et donnez vie à vos batailles avec brio
        </p>
      </div>

      {purchaseMessage && (
        <p className="text-center font-bold text-lg mb-4 text-blue-600">{purchaseMessage}</p>
      )}

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4"> Sélectionner un cosmétique</h2>

        <h3 className="text-lg font-semibold mt-4"> Sélectionner un Plateau</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => theme.owned && theme.type === 'board').map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              mode="select"
              onSelect={() => handleSelectCosmetic('board', theme.cssClass)}
              selected={selectedBoard === theme.cssClass}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold mt-8">♟️ Sélectionner un Pion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => theme.owned && theme.type === 'pawn').map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              mode="select"
              onSelect={() => handleSelectCosmetic('pawn', theme.cssClass)}
              selected={selectedPawn === theme.cssClass}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold mt-8">🛒 Acheter un Plateau</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => !theme.owned && theme.type === 'board').map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              mode="purchase"
              onPurchase={() => handlePurchase(theme.id)}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold mt-8">🛒 Acheter un Pion</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => !theme.owned && theme.type === 'pawn').map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              mode="purchase"
              onPurchase={() => handlePurchase(theme.id)}
            />
          ))}
        </div>
      </section>

    </PageLayout>
  );
};

export default ShopPage;
