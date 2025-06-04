import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi } from '../services/api';
import CoinPackageCard from '../components/CoinPackageCard';
import type { CoinPackage } from '@/types';

const CoinPurchasePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check for Stripe redirect parameters
  const paymentStatus = searchParams.get('payment');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    loadCoinPackages();
    
    // Handle Stripe success/cancel redirects
    if (paymentStatus === 'success' && sessionId) {
      setSuccessMessage('Payment successful! Your coins will be added to your account shortly.');
      // Refresh profile to update coin balance
      refreshProfile();
      // Clear the URL parameters
      window.history.replaceState({}, '', '/buy-coins');
    } else if (paymentStatus === 'cancelled') {
      setError('Payment was cancelled. You can try again below.');
      // Clear the URL parameters
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

      // Handle mock purchases in development
      if (packageId.startsWith('mock_')) {
        const realPackageId = packageId.replace('mock_', '');
        await paymentApi.mockPurchase(realPackageId);
        
        // Refresh user profile to show updated balance
        await refreshProfile();
        
        // Show success message
        alert('Mock purchase successful! Your coin balance has been updated.');
        return;
      }

      // Real Stripe purchase
      const checkout = await paymentApi.createCheckoutSession(packageId);
      
      // Redirect to Stripe checkout
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Loading coin packages...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-gray-900">Quoridor</span>
              </Link>
              <span className="ml-2 text-gray-400">/</span>
              <span className="ml-2 text-gray-600">Buy Coins</span>
            </div>
            
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  Welcome, <span className="font-medium">{user.username}</span>
                </div>
                <div className="flex items-center space-x-1 bg-yellow-100 px-3 py-1 rounded-full">
                  <span className="text-lg">🪙</span>
                  <span className="font-semibold text-yellow-800">{user.coinBalance || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buy Coins</h1>
          <p className="text-lg text-gray-600">
            Purchase coins to unlock premium themes and features
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
                <div className="mt-3">
                  <button
                    onClick={loadCoinPackages}
                    className="text-sm font-medium text-red-800 underline hover:text-red-900"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400">✅</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">{successMessage}</div>
              </div>
            </div>
          </div>
        )}

        {/* Coin Packages Grid */}
        {packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">🪙</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No coin packages available</h3>
              <p className="text-gray-600">Please try again later.</p>
            </div>
          )
        )}

        {/* Info Section */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-blue-800">
            <div className="flex items-start">
              <span className="mr-2">1️⃣</span>
              <span>Choose a coin package that suits your needs</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2">2️⃣</span>
              <span>Complete your purchase securely with Stripe</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2">3️⃣</span>
              <span>Use your coins to unlock premium themes and features</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Larger packages offer bonus coins for better value!
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CoinPurchasePage; 