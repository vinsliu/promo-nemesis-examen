// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../services/client';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.name === 'username' ? e.target.value.toLowerCase() : e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const password = formData.password;
    if ([...password].length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) || !/[^A-Za-z0-9\s]/.test(password) || new TextEncoder().encode(password).length > 72) {
      setError('Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (72 octets maximum).');
      return;
    }
    try {
      await client.post('/auth/register', formData);
      alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      navigate('/login');
    } catch (err) {
      if (err.response) {
        // Erreur renvoyée par le serveur
        const { message } = err.response.data;
        setError(message);
      } else {
        // Erreur réseau ou autre
        console.error("Erreur réseau ou serveur");
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
      //setError('Une erreur est survenue lors de la création du compte.');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4 text-center">Inscription</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="text"
          name="username"
          required
          maxLength={100}
          autoComplete="username"
          placeholder="Nom d'utilisateur"
          value={formData.username}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="password"
          name="password"
          minLength={12}
          required
          autoComplete="new-password"
          aria-describedby="password-help"
          placeholder="Mot de passe"
          value={formData.password}
          onChange={handleChange}
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <p id="password-help" className="text-sm text-gray-600 mb-4">
          Au moins 12 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial.
        </p>
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">S'inscrire</button>
      </form>
    </div>
  );
};

export default Register;
