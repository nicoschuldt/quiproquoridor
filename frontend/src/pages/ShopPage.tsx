import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shopApi } from '../services/api';
import type { ShopBrowseResponse } from '@/types';

const ShopPage: React.FC = () => {
  const navigate = useNavigate();
  const [shopData, setShopData] = useState<ShopBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShop = async () => {
    try {
      setLoading(true);
      const data = await shopApi.getShopData();
      setShopData(data);
      console.log('Données de la boutique:', data); // Debugging
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de la boutique');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShop();
  }, []);

  const handlePurchase = async (shopItemId: string) => {
    try {
      setLoading(true);
      await shopApi.purchaseTheme(shopItemId);
      await loadShop();
    } catch (err: any) {
      setError(err.message || 'Achat échoué');
    } finally {
      setLoading(false);
    }
  };

  const isOwned = (cssClass: string) => {
    return shopData?.owned?.some(item => item.cssClass === cssClass) ?? false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button
              onClick={() => navigate('/')}
              className="text-2xl font-bold text-gray-900 hover:text-pink-600"
            >
              Quoridor Shop
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        <h1 className="text-3xl font-bold text-center text-gray-900">Boutique</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {shopData && (
          <>
            <section className="text-center">
              <p className="text-xl text-gray-700">
                💰 Solde de pièces : <span className="font-bold">{shopData?.coinBalance ?? 0}</span>
              </p>
            </section>

            {/* THEMES BOARD */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">Plateaux disponibles</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {shopData?.available?.filter(item => item.type === 'board').map((theme) => {
                  const owned = isOwned(theme.cssClass);
                  return (
                    <div key={theme.id} className="bg-white p-4 rounded-lg shadow-md text-center">
                      <p className="font-bold mb-1">{theme.name}</p>
                      <p className="text-sm text-gray-500 mb-2">{theme.priceCoins} pièces</p>
                      {owned ? (
                        <div className="text-green-600 font-semibold">Déjà acheté</div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(theme.id)}
                          disabled={loading || (shopData?.coinBalance ?? 0) < theme.priceCoins}
                          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          Acheter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* THEMES PAWN */}
            <section>
              <h2 className="text-2xl font-semibold mt-10 mb-4">Pions disponibles</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {shopData?.available?.filter(item => item.type === 'pawn').map((theme) => {
                  const owned = isOwned(theme.cssClass);
                  return (
                    <div key={theme.id} className="bg-white p-4 rounded-lg shadow-md text-center">
                      <p className="font-bold mb-1">{theme.name}</p>
                      <p className="text-sm text-gray-500 mb-2">{theme.priceCoins} pièces</p>
                      {owned ? (
                        <div className="text-green-600 font-semibold">Déjà acheté</div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(theme.id)}
                          disabled={loading || (shopData?.coinBalance ?? 0) < theme.priceCoins}
                          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          Acheter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <div className="text-center mt-10">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Retour à l’accueil
          </button>
        </div>
      </main>
    </div>
  );
};

export default ShopPage;
