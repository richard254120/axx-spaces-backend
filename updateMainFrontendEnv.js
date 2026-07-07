import fs from 'fs';
import dotenv from 'dotenv';

// Update main frontend .env
const frontendEnvPath = '/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/.env';
let frontendEnvConfig = {};

// Read existing frontend .env if it exists
if (fs.existsSync(frontendEnvPath)) {
  frontendEnvConfig = dotenv.parse(fs.readFileSync(frontendEnvPath));
}

// Update the VITE_API_URL to point to production backend
frontendEnvConfig.VITE_API_URL = 'https://axx-spaces-backend-1.onrender.com/api';

// Write back to frontend .env file
const frontendEnvContent = Object.entries(frontendEnvConfig)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(frontendEnvPath, frontendEnvContent);
console.log('✅ Updated main frontend .env file with VITE_API_URL=https://axx-spaces-backend-1.onrender.com/api');
