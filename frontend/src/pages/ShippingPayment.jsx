import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShippingMethodSelection from '../components/ShippingMethodSelection';
import PaymentMethodSelection from '../components/handlePaymentChange';
import ShippingAddress from '../components/ShippingAddress';
import { useCart } from '../context/CartContext';


/** Page « Livraison et paiement » : adresse, transporteur et paiement, puis passage à la synthèse (/order). */
const ShippingPayment = () => {
  const navigate = useNavigate();
  const { shippingAddress } = useCart();
  const [error, setError] = useState('');
  // Naviguer vers la page de commande
  const handleSubmitOrder = (event) => {
    event.preventDefault();
    const invalidField = Object.entries({ street: 200, city: 100, postalCode: 20, country: 100 })
      .find(([field, max]) => typeof shippingAddress[field] !== 'string' ||
        !shippingAddress[field].trim() || shippingAddress[field].trim().length > max);
    if (invalidField) {
      setError('Veuillez renseigner une adresse de livraison complète (rue, ville, code postal et pays).');
      event.currentTarget.elements.namedItem(invalidField[0])?.focus();
      return;
    }
    setError('');
    navigate('/order');
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Livraison et Paiement</h2>
      <form onSubmit={handleSubmitOrder} noValidate>
      {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <ShippingAddress /> 
        </div>
        <div>
          <ShippingMethodSelection />
          <PaymentMethodSelection />
        </div>
      </div>
      <hr className="my-4" />
      <div>
      <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Passer une commande
      </button>
      </div>
      </form>
    </div>
  );
};

export default ShippingPayment;
