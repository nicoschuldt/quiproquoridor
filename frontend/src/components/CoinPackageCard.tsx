import React from 'react';
import type { CoinPackage } from '@/types';

interface CoinPackageCardProps {
  package: CoinPackage;
  onPurchase: (packageId: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

const CoinPackageCard: React.FC<CoinPackageCardProps> = ({
  package: pkg,
  onPurchase,
  isLoading = false,
  disabled = false,
}) => {
  const totalCoins = pkg.coins + (pkg.bonusCoins || 0);
  const savingsPercentage = pkg.bonusCoins ? Math.round((pkg.bonusCoins / pkg.coins) * 100) : 0;

  const handlePurchase = async () => {
    if (disabled || isLoading) return;
    await onPurchase(pkg.id);
  };

  return (
    <div className={`
      relative bg-white rounded-lg border-2 shadow-sm transition-all duration-200 hover:shadow-md
      ${pkg.popularBadge ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'}
    `}>
      {/* Popular Badge */}
      {pkg.popularBadge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
            Most Popular
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Package Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
          {pkg.name}
        </h3>

        {/* Coin Display */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl font-bold text-yellow-600">{totalCoins}</span>
            <span className="text-lg text-gray-600">coins</span>
          </div>
          
          {pkg.bonusCoins && (
            <div className="text-sm text-green-600 font-medium">
              {pkg.coins} + {pkg.bonusCoins} bonus ({savingsPercentage}% extra!)
            </div>
          )}
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          <span className="text-2xl font-bold text-gray-900">
            ${pkg.priceUSD.toFixed(2)}
          </span>
        </div>

        {/* Value proposition */}
        <div className="text-center text-sm text-gray-500 mb-4">
          ${(pkg.priceUSD / totalCoins).toFixed(3)} per coin
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={disabled || isLoading}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200
            ${pkg.popularBadge 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-900 hover:bg-gray-800 text-white'
            }
            ${disabled || isLoading 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:shadow-md'
            }
          `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            'Buy Now'
          )}
        </button>

        {/* Development mock button */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => onPurchase(`mock_${pkg.id}`)}
            disabled={disabled || isLoading}
            className="w-full mt-2 py-2 px-4 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors duration-200"
          >
            🧪 Mock Purchase (Dev)
          </button>
        )}
      </div>
    </div>
  );
};

export default CoinPackageCard; 