import React, { useEffect, useState } from 'react';
import ThemePreviewCard from '../components/shop/ThemePreviewCard';
import PageLayout from '../components/PageLayout';
import { shopApi } from '../services/api';
import type { ShopItem } from '@/types';

const ShopPage: React.FC = () => {
  const [themes, setThemes] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null); // Message après achat

  const loadThemes = async () => {
  setLoading(true);
  setError(null);
  setPurchaseMessage(null);
  try {
    const data = await shopApi.getShopData();
    const allThemes = [...data.available, ...data.owned.map(t => ({ ...t, owned: true }))]; // Ajout de la propriété
    setThemes(allThemes);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Unknown error loading shop');
  } finally {
    setLoading(false);
  }
};

const [selectedCosmetic, setSelectedCosmetic] = useState<string | null>(null);
const handleSelectCosmetic = async (cosmeticId: string) => {
  setSelectedCosmetic(cosmeticId);
  try {
    await shopApi.selectTheme('pawn', cosmeticId); // Enregistre le choix du cosmétique actif
  } catch (error) {
    console.error("Erreur lors de la sélection du cosmétique:", error);
  }
};



  useEffect(() => {
    loadThemes();
  }, []);

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

  
  {themes.filter(theme => theme.owned).length === 0 ? (
    <p className="text-center text-gray-600">Vous n'avez pas encore de cosmétiques. Achetez-en dans le shop !</p>
  ) : (
    
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {themes.filter(theme => theme.owned).map(theme => (
        
        <ThemePreviewCard
          key={theme.id}
          item={theme}
          onPurchaseSuccess={loadThemes}
          onPurchase={() => handleSelectCosmetic(theme.id)} // Sélectionner un cosmétique pour jouer avec
        />
      ))}
    </div>
    
  )}
</section>
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
