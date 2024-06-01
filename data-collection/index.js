const fs = require('fs').promises;
const path = require('path');
const CryptoData = require('./crypto/crypto_data');
const AccountData = require('./account/account_data');
require('dotenv').config();

const EventEmitter = require('events');
const aiEventEmitter = new EventEmitter();

(async () => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

        config.trading_settings.forEach(setting => {
            const { symbol, operation_delay, max_log_length } = setting;
            new CryptoData(symbol, max_log_length, operation_delay);
            console.log(`New crypto tracker created for ${symbol}`);
        });

        aiEventEmitter.on('fetchAccountData', async () => {
            console.log('Received fetchAccountData event');
            const accountData = await AccountData.fetchAccountData();
            if (accountData) {
                await AccountData.saveAccountData(accountData);
            }
        });

        setTimeout(() => {
            aiEventEmitter.emit('fetchAccountData');
        }, 1000);
    } catch (error) {
        console.error('Error initializing the application:', error);
    }
})();
