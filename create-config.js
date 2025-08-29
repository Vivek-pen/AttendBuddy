// create-config.js
const fs = require('fs');

// This is the content that will be written to config.js
const configContent = `
const firebaseConfig = {
  apiKey: "${process.env.API_KEY}",
  authDomain: "${process.env.AUTH_DOMAIN}",
  projectId: "${process.env.PROJECT_ID}",
  storageBucket: "${process.env.STORAGE_BUCKET}",
  messagingSenderId: "${process.env.MESSAGING_SENDER_ID}",
  appId: "${process.env.APP_ID}"
};
`;

// This command writes the content to a file named 'config.js' in the root directory
fs.writeFileSync('config.js', configContent.trim());

console.log('Successfully created config.js for Netlify deployment!');