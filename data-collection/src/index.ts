import { promises as fs } from 'fs';
import path from 'path';
import CryptoData from './crypto/crypto_data';
import EventMarket from './events/event_market';
import EventCallbacks from './events/event_callbacks';
import dotenv from 'dotenv';

dotenv.config();

const eventMarket = new EventMarket();

(async () => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

        config.trading_settings.forEach((setting: any) => {
            const { symbol, operation_delay, max_log_length } = setting;
            new CryptoData(symbol, max_log_length, operation_delay, eventMarket);
            console.log(`New crypto tracker created for ${symbol}`);
        });

        eventMarket.addEventListener('fetchAccountData', (data: any) => {
            EventCallbacks.fetchAccountData(data);
        });

        setTimeout(() => {
            eventMarket.emitEvent('fetchAccountData', 'all');
        }, 1000);

        eventMarket.addEventListener('print', (data: any) => {
            console.log(`New print event from decision-making: ${data}`);
        });
    } catch (error) {
        console.error('Error initializing the application:', error);
    }
})();
