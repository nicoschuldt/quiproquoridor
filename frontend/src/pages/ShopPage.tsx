import React, { useEffect, useState } from 'react';
import ThemePreviewCard from '../components/shop/ThemePreviewCard';
import PageLayout from '../components/PageLayout';
import { shopApi } from '../services/api';
import type { ShopItem } from '@/types';

const ShopPage: React.FC = () => {
  const [themes, setThemes] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopApi.getShopData();
      const allThemes = [...data.available, ...data.owned];
      setThemes(allThemes);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError('Unknown error loading themes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  return (
    <PageLayout title="Pawn Theme Previews" showBackButton>
      <div className="text-center mb-8 mt-6 max-w-4xl mx-auto px-4">
        <div className="text-6xl mb-2">🎨</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-1">Pawn Theme Previews</h1>
        <p className="text-lg text-gray-600 mb-4">
          Choose your favorite pawn and board style below and bring your battles to life with flair!
        </p>
      </div>

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      {loading ? (
        <p className="text-center">Loading themes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {themes.map(theme => (
            <ThemePreviewCard
              key={theme.id}
              item={theme}
              onPurchaseSuccess={loadThemes}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default ShopPage;
