import fs from 'fs';
import dotenv from 'dotenv';

// Update admin panel .env
const adminEnvPath = '/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/.env';
let adminEnvConfig = {};

// Read existing admin .env if it exists
if (fs.existsSync(adminEnvPath)) {
  adminEnvConfig = dotenv.parse(fs.readFileSync(adminEnvPath));
}

// Update the REACT_APP_API_URL to point to production backend
adminEnvConfig.REACT_APP_API_URL = 'https://axx-spaces-backend-1.onrender.com/api';

// Write back to admin .env file
const adminEnvContent = Object.entries(adminEnvConfig)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(adminEnvPath, adminEnvContent);
console.log('✅ Updated admin panel .env file with REACT_APP_API_URL=https://axx-spaces-backend-1.onrender.com/api');
