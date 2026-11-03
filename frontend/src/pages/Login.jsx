// src/pages/Login.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import client from "../services/client";
import { saveSession } from "../services/session";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Le jeton est posé par le serveur dans un cookie HttpOnly.
      const response = await client.post("/auth/login", credentials);
      saveSession(response.data);
      const returnTo = location.state?.returnTo;
      navigate(typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : '/', { replace: true }); // Redirige vers la page d'accueil après la connexion
    } catch (error) {
      // Gestion des erreurs
      if (error.response) {
        // Erreur renvoyée par le serveur
        const { message } = error.response.data;
        alert(message); // Affiche un message à l'utilisateur (vous pouvez remplacer par un toast)
      } else {
        // Erreur réseau ou autre
        console.error("Erreur réseau ou serveur");
        alert("Une erreur est survenue. Veuillez réessayer.");
      }
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-80"
      >
        <h2 className="text-2xl font-bold mb-4 text-center">Connexion</h2>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={credentials.username}
          onChange={(e) =>
            setCredentials({ ...credentials, username: e.target.value })
          }
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={credentials.password}
          onChange={(e) =>
            setCredentials({ ...credentials, password: e.target.value })
          }
          className="border border-gray-300 p-2 w-full mb-4"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 w-full rounded"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
};

export default Login;
