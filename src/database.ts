import mysql, { Connection } from 'mysql2/promise';

export const connectDB = async (): Promise<Connection> => {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: ''
    });

    // Create database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS LIBRARY');
    await connection.query('USE LIBRARY');

    // Create USERS table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS USERS (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        NAME VARCHAR(255) NOT NULL,
        BORROWED_BOOKS TEXT,
        RETURNED_BOOKS TEXT
      );
    `);

    // Create BOOKS table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS BOOKS (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        NAME VARCHAR(255) NOT NULL,
        SCORES TEXT
      )
    `);

    console.log('Connected to the database.');
    return connection;
  } catch (error) {
    console.error('Error connecting to MySQL database', (error as Error).message);
    process.exit(1);
  }
};
