// This script creates a user and makes them an admin for testing purposes
// Run with: node scripts/create-admin.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'admin@example.com';
const PASSWORD = 'password123';
const NAME = 'Admin User';

async function createAdminUser() {
  try {
    console.log('Creating user...');
    
    // Register the user
    const registerResponse = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: NAME,
        email: EMAIL,
        password: PASSWORD,
      }),
    });
    
    const registerData = await registerResponse.json();
    
    if (!registerResponse.ok) {
      if (registerData.error === 'User with this email already exists') {
        console.log('User already exists, proceeding to make them an admin...');
      } else {
        throw new Error(`Registration failed: ${registerData.error}`);
      }
    } else {
      console.log('User created successfully!');
    }
    
    // Make the user an admin
    console.log('Making user an admin...');
    const adminResponse = await fetch(`${BASE_URL}/api/admin/create-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: EMAIL,
      }),
    });
    
    const adminData = await adminResponse.json();
    
    if (!adminResponse.ok) {
      throw new Error(`Failed to make user an admin: ${adminData.error}`);
    }
    
    console.log('Success!', adminData.message);
    console.log('\nAdmin user created with the following credentials:');
    console.log(`Email: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log('\nYou can now log in with these credentials.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createAdminUser();