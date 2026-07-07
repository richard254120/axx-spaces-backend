import fs from 'fs';
import dotenv from 'dotenv';

// Read the current .env file
const envPath = '/home/oguda/Desktop/AXX/backend/axx-spaces-backend/.env';
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Update the MONGO_URI
envConfig.MONGO_URI = 'mongodb+srv://ogudarichard_db:Oguda6993@cluster0.rnqxluz.mongodb.net/axx-spaces?retryWrites=true&w=majority';

// Write back to .env file
const envContent = Object.entries(envConfig)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(envPath, envContent);
console.log('✅ Updated .env file with production MongoDB connection string');
