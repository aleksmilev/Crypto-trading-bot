const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const configFilePath = path.join(__dirname, '../config.json');

class AccountData {
    static async fetchAccountData() {
        const apiKey = process.env.BINANCE_API_KEY;
        const apiSecret = process.env.BINANCE_API_SECRET;

        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(queryString)
            .digest('hex');

        const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'X-MBX-APIKEY': apiKey
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching account data:', error);
            return null;
        }
    }

    static async filterBalances(accountData) {
        try {
            const configData = JSON.parse(await fs.readFile(configFilePath, 'utf-8'));
            const tradingSymbols = configData.trading_settings.map(setting => setting.symbol.replace('USDT', ''));

            const filteredBalances = accountData.balances.filter(balance => 
                tradingSymbols.includes(balance.asset)
            );

            return {
                ...accountData,
                balances: filteredBalances
            };
        } catch (error) {
            console.error('Error filtering balances:', error);
            return accountData;
        }
    }

    static async saveAccountData(data) {
        const filePath = path.join(__dirname, '../../logs/account', 'account_data.json');
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            console.log('Account data saved successfully');
        } catch (error) {
            console.error('Error saving account data:', error);
        }
    }

    static async updateAccountData() {
        const accountData = await this.fetchAccountData();
        if (accountData) {
            const filteredAccountData = await this.filterBalances(accountData);
            await this.saveAccountData(filteredAccountData);
        }
    }
}

module.exports = AccountData;
