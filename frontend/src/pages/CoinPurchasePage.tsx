import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi } from '../services/api';
import CoinPackageCard from '../components/CoinPackageCard';
import PageLayout from '../components/PageLayout';
import type { CoinPackage } from '@/types';

const CoinPurchasePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const paymentStatus = searchParams.get('payment');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    loadCoinPackages();
    
    if (paymentStatus === 'success' && sessionId) {
      setSuccessMessage('Payement réussit.');
      refreshProfile();
      window.history.replaceState({}, '', '/buy-coins');
    } else if (paymentStatus === 'cancelled') {
      setError('Payement interrompu.');
      window.history.replaceState({}, '', '/buy-coins');
    }
  }, [paymentStatus, sessionId, refreshProfile]);

  const loadCoinPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentApi.getCoinPackages();
      setPackages(data);
    } catch (err: any) {
      console.error('Failed to load coin packages:', err);
      setError(err.message || 'Failed to load coin packages');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    try {
      setPurchaseLoading(packageId);
      setError(null);
      if (packageId.startsWith('mock_')) {
        const realPackageId = packageId.replace('mock_', '');
        await paymentApi.mockPurchase(realPackageId);
        await refreshProfile();
        setSuccessMessage('Mock purchase successful! Your coin balance has been updated.');
        return;
      }
      const checkout = await paymentApi.createCheckoutSession(packageId as 'starter' | 'popular' | 'pro');
      window.location.href = checkout.checkoutUrl;
    } catch (err: any) {
      console.error('Purchase failed:', err);
      setError(err.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchaseLoading(null);
    }
  };

  if (loading) {
    return (
      <PageLayout showBackButton title="Buy Coins">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900">Chargement des jetons...</h2>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showBackButton title="Buy Coins" maxWidth="4xl">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🪙</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Achète des jetons</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Achète des jetons pour débloquer des thèmes, des avatars et plus encore dans Quiproquoridor.
        </p>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-red-600 text-sm">⚠</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 mb-1">Erreur</h3>
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadCoinPackages}
                className="mt-2 text-sm font-medium text-red-800 underline hover:text-red-900"
              >
                Recommence
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="card border-green-200 bg-green-50 text-green-700 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 text-sm">✓</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 mb-1">Confirmation</h3>
              <p className="text-green-600">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {packages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {packages.map((pkg) => (
            <CoinPackageCard
              key={pkg.id}
              package={pkg}
              onPurchase={handlePurchase}
              isLoading={purchaseLoading === pkg.id || purchaseLoading === `mock_${pkg.id}`}
              disabled={!!purchaseLoading}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="card text-center py-16 mb-12">
            <div className="text-6xl mb-4">🪙</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun pack de jetons disponible</h3>
            <p className="text-gray-600">Réessaye plus tard.</p>
            <button
              onClick={loadCoinPackages}
              className="btn btn-primary mt-4"
            >
              Recommence
            </button>
          </div>
        )
      )}


    </PageLayout>
  );
};

export default CoinPurchasePage; 