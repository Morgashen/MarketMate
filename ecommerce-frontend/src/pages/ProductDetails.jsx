import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: ''
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProduct();
  }, [id]);

  const handleChange = (e) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/products/${id}`, product);
      alert('Product updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to update product');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure?')) {
      try {
        await api.delete(`/products/${id}`);
        alert('Product deleted!');
        navigate('/');
      } catch (err) {
        console.error(err);
        alert('Failed to delete product');
      }
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <h2>Edit Product</h2>
      <input type="text" name="name" value={product.name} onChange={handleChange} />
      <br /><br />

      <textarea name="description" value={product.description} onChange={handleChange} />
      <br /><br />

      <input type="number" name="price" value={product.price} onChange={handleChange} />
      <br /><br />

      <input type="text" name="category" value={product.category} onChange={handleChange} />
      <br /><br />

      <input type="text" name="image" value={product.image} onChange={handleChange} />
      <br /><br />

      <button onClick={handleUpdate}>Update</button>
      <button onClick={handleDelete} style={{ marginLeft: '10px' }}>Delete</button>
    </div>
  );
};

export default ProductDetails;