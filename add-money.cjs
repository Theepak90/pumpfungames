#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read users.json
const usersPath = path.join(__dirname, 'users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

// Function to add money to a user
function addMoney(username, amount) {
  const user = users.find(u => u.username === username);
  if (!user) {
    console.log(`❌ User "${username}" not found`);
    return false;
  }
  
  user.balance += amount;
  console.log(`✅ Added $${amount} to ${username}. New balance: $${user.balance.toFixed(2)}`);
  return true;
}

// Function to list all users
function listUsers() {
  console.log('\n📋 Current Users:');
  users.forEach(user => {
    console.log(`  ${user.username}: $${user.balance.toFixed(2)} (ID: ${user.id})`);
  });
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node add-money.cjs <username> <amount>');
  console.log('Example: node add-money.cjs testuser 100');
  console.log('\nOr use "list" to see all users:');
  console.log('Example: node add-money.cjs list');
  process.exit(1);
}

const username = process.argv[2];

if (username === 'list') {
  listUsers();
} else if (process.argv.length < 4) {
  console.log('❌ Please provide an amount for the user.');
  process.exit(1);
} else {
  const amount = parseFloat(process.argv[3]);
  if (isNaN(amount) || amount <= 0) {
    console.log('❌ Invalid amount. Please provide a positive number.');
    process.exit(1);
  }
  
  if (addMoney(username, amount)) {
    // Save updated users
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('💾 Users file updated successfully!');
  }
} 