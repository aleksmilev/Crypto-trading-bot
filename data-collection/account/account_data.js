const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

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
        }  catch (error) {
            console.error('Error fetching account data:', error);
            return error;
        }
    }

    static async saveAccountData(data) {
        const filePath = path.join(__dirname, '../../logs/account', 'account_data.json');
        try {
            await fs.access(filePath).catch(async (error) => {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(filePath, '[]');
                    console.log('Account data file created successfully');
                } else {
                    throw error;
                }
            });

            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            console.log('Account data saved successfully');
        } catch (error) {
            console.error('Error saving account data:', error);
        }
    }
}

module.exports = AccountData;
