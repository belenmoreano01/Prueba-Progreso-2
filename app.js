const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3307;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
};
const pool = mysql.createPool(dbConfig);

app.get('/datos/:usuario', async (req, res) => {
  try {
    const { usuario } = req.params;

    // Verificar si el nombre de usuario está presente en la solicitud
    if (!usuario) {
      return res.status(400).json({ error: 'Se requiere el nombre de usuario en la solicitud.' });
    }

    // Conectar a la base de datos MySQL
    const connection = await pool.getConnection();

    // Consultar la ciudad del usuario en la base de datos
    const [rows] = await connection.execute('SELECT ciudad FROM usuarios WHERE usuario = ?', [usuario]);

    if (rows.length > 0) {
      // Obtener la ciudad del usuario
      const city = rows[0].ciudad;

      // Construir la URL para la solicitud a la API de Geocode.xyz
      const apiKey = process.env.API_KEY;
      const apiUrl = `https://geocode.xyz/${city}?json=1&auth=${apiKey}`;

      // Hacer la solicitud a la API de Geocode.xyz
      const response = await axios.get(apiUrl);

      // Procesar la respuesta y enviarla al cliente
      const geolocationData = response.data;

      // Insertar datos en la tabla de geolocalización
      const [insertResult] = await connection.execute(
        'INSERT INTO geolocation_data (city, province, country, latitude, longitude, confidence) VALUES (?, ?, ?, ?, ?, ?)',
        [
          geolocationData.standard.city,
          geolocationData.standard.prov,
          geolocationData.standard.countryname,
          geolocationData.latt,
          geolocationData.longt,
          parseFloat(geolocationData.standard.confidence),
        ]
      );

      // Enviar la respuesta al cliente
      res.json({
        message: 'Datos guardados correctamente.',
        geolocationData,
        insertedId: insertResult.insertId,
      });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado en la base de datos.' });
    }

    // Liberar la conexión a la base de datos
    connection.release();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la georreferenciación.' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
