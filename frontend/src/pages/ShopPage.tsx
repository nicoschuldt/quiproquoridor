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

  // Chargement des thèmes depuis l'API
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

  // Sélection d'un cosmétique actif (board ou pawn)
  const handleSelectCosmetic = async (themeType: 'board' | 'pawn', cosmeticId: string) => {
    if (themeType === 'board') {
      setSelectedBoard(cosmeticId);
    } else {
      setSelectedPawn(cosmeticId);
    }

    try {
      await shopApi.selectTheme(themeType, cosmeticId);
    } catch (error) {
      console.error("Erreur lors de la sélection du cosmétique:", error);
    }
  };

  // Achat d'un cosmétique et mise à jour
  const handlePurchase = async (shopItemId: string) => {
    setPurchaseMessage(null);
    try {
      setLoading(true);
      const response = await shopApi.purchaseTheme(shopItemId);

      if (response.success && response.purchasedItem) {
        setPurchaseMessage(`✅ Achat réussi : ${response.purchasedItem.name}`);

        setThemes(prevThemes =>
          prevThemes.map(theme =>
            theme.id === shopItemId ? { ...theme, owned: true, previewImageUrl: response.purchasedItem.previewImageUrl || "/images/pawns/default.png" } : theme
          )
        );
      } else {
        setPurchaseMessage(`❌ Achat échoué : ${response.message || 'Donnée manquante dans la réponse'}`);
      }
    } catch (err: any) {
      setPurchaseMessage(`❌ Erreur d'achat : ${err.message || 'Échec inconnu'}`);
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
          Choose your favorite pawn and board style below and bring your battles to life with flair!
        </p>
      </div>

      {/* Message après achat */}
      {purchaseMessage && (
        <p className="text-center font-bold text-lg mb-4 text-blue-600">{purchaseMessage}</p>
      )}

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      {/* Sélection des Cosmétiques */}
      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">🎨 Sélectionner un cosmétique</h2>

        {/* Sélection des Boards */}
        <h3 className="text-lg font-semibold mt-4">🛑 Sélectionner un Board</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => theme.owned && theme.type === 'board').map(theme => (
            <div 
              key={theme.id} 
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedBoard === theme.id ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
              }`}
              onClick={() => handleSelectCosmetic('board', theme.id)}
            >
              {/* <img 
                src={theme.previewImageUrl || "/images/boards/default.png"} 
                alt={theme.name} 
                className="w-full h-auto rounded-md"
                onError={(e) => { e.currentTarget.src = "/images/boards/default.png"; }}
              /> */}
              <p className="text-center font-semibold mt-2">{theme.name}</p>
              {selectedBoard === theme.id && <p className="text-center text-blue-600 font-semibold mt-2">✔ Sélectionné</p>}
            </div>
          ))}
        </div>

        {/* Sélection des Pawns */}
        <h3 className="text-lg font-semibold mt-6">♟️ Sélectionner un Pawn</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {themes.filter(theme => theme.owned && theme.type === 'pawn').map(theme => (
            <div 
              key={theme.id} 
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedPawn === theme.id ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
              }`}
              onClick={() => handleSelectCosmetic('pawn', theme.id)}
            >

              <p className="text-center font-semibold mt-2">{theme.name}</p>
              {selectedPawn === theme.id && <p className="text-center text-blue-600 font-semibold mt-2">✔ Sélectionné</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Liste des items disponibles à l'achat */}
      {loading ? (
        <p className="text-center">Loading themes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {themes.filter(theme => !theme.owned).map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              onPurchaseSuccess={loadThemes}
              onPurchase={() => handlePurchase(theme.id)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default ShopPage;
