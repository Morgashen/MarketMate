import React, { useState } from 'react';
import api from '../api';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/products', formData);
      alert('Product added successfully!');
      console.log(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert('Failed to add product');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <h2>Add New Product</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" name="name" placeholder="Name" onChange={handleChange} required />
        <br /><br />

        <textarea name="description" placeholder="Description" onChange={handleChange} required />
        <br /><br />

        <input type="number" name="price" placeholder="Price" onChange={handleChange} required />
        <br /><br />

        <input type="text" name="category" placeholder="Category" onChange={handleChange} required />
        <br /><br />

        <input type="text" name="image" placeholder="Image URL" onChange={handleChange} />
        <br /><br />

        <button type="submit">Add Product</button>
      </form>
    </div>
  );
};

export default AddProduct;