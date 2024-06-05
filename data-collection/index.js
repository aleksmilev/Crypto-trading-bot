const fs = require('fs').promises;
const path = require('path');
const CryptoData = require('./crypto/crypto_data');
const EventMarket = require('./events/event_market');
const EventCallbacks = require('./events/event_callbacks');
const eventMarket = new EventMarket();
require('dotenv').config();

(async () => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

        config.trading_settings.forEach(setting => {
            const { symbol, operation_delay, max_log_length } = setting;
            new CryptoData(symbol, max_log_length, operation_delay, eventMarket);
            console.log(`New crypto tracker created for ${symbol}`);
        });

        eventMarket.addEventListener('fetchAccountData', (data) => {
            EventCallbacks.fetchAccountData(data);
        });

        setTimeout(() => {
            eventMarket.emitEvent('fetchAccountData', 'all');
        }, 1000);

        eventMarket.addEventListener('print', (data) => {
            console.log(`New pring event form decision-making: ${data}`);
        });
    } catch (error) {
        console.error('Error initializing the application:', error);
    }
})();
