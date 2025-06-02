import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

const COIN_PACKS = [
  { coins: 100, price: 199 },
  { coins: 500, price: 799 },
  { coins: 1000, price: 1499 },
];

const CheckoutForm: React.FC<{ coins: number; price: number }> = ({ coins, price }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data } = await axios.post('/api/purchase/create-payment-intent', {
      amount: price,
      coins,
    });

    const result = await stripe?.confirmCardPayment(data.clientSecret, {
      payment_method: {
        card: elements?.getElement(CardElement)!,
      },
    });

    if (result?.error) {
      setMessage(result.error.message || 'Paiement échoué');
    } else if (result?.paymentIntent?.status === 'succeeded') {
      setMessage('Achat réussi ! Les pièces seront créditées sous peu.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CardElement />
      <button type="submit" disabled={!stripe || loading} className="btn-primary">
        {loading ? 'Paiement...' : `Acheter ${coins} pièces pour ${(price / 100).toFixed(2)}€`}
      </button>
      {message && <div className="mt-2 text-center">{message}</div>}
    </form>
  );
};

const BuyCoinsPage: React.FC = () => {
  const [selectedPack, setSelectedPack] = useState(COIN_PACKS[0]);

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-4">Acheter des pièces</h1>
          <div className="mb-6">
            {COIN_PACKS.map((pack) => (
              <button
                key={pack.coins}
                className={`btn ${selectedPack.coins === pack.coins ? 'btn-primary' : 'btn-secondary'} mr-2`}
                onClick={() => setSelectedPack(pack)}
              >
                {pack.coins} pièces - {(pack.price / 100).toFixed(2)}€
              </button>
            ))}
          </div>
          <CheckoutForm coins={selectedPack.coins} price={selectedPack.price} />
        </div>
      </div>
    </Elements>
  );
};

export default BuyCoinsPage;