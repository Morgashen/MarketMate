// src/pages/Cart.jsx
import React, { useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';

const Cart = () => {
  const { state, dispatch } = useContext(CartContext);
  const navigate = useNavigate();

  const removeFromCart = (item) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: item });
  };

  const totalPrice = state.cart.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        'http://localhost:5000/api/checkout/create-checkout-session',
        { cartItems: state.cart },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      window.location.href = `https://checkout.stripe.com/c/pay/${res.data.id}`; 
    } catch (err) {
      console.error(err);
      alert('Failed to start checkout');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Shopping Cart</h2>
      {state.cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {state.cart.map((item) => (
            <div key={item._id} style={{ borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
              <h4>{item.name}</h4>
              <p>${item.price}</p>
              <button onClick={() => removeFromCart(item)}>Remove</button>
            </div>
          ))}
          <h3>Total: ${totalPrice.toFixed(2)}</h3>
          <button onClick={handleCheckout}>Proceed to Checkout</button>
        </>
      )}
    </div>
  );
};

export default Cart;