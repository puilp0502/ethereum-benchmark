const fs = require('fs');
const Web3 = require('web3');
const accounts = require('./accounts.js');

const web3 = new Web3();

const password = fs.readFileSync('../password.txt', 'utf-8').replace(/\n/g, '');
module.exports = web3.eth.accounts.wallet.decrypt(accounts, password); 

