const axios = require('axios');
const FileManager = require('./crypto_file_manager');

class CryptoData {
    constructor(symbol, maxLogLength, operationDelay) {
        this.symbol = symbol;
        this.operationDelay = operationDelay;
        this.fileManager = new FileManager(symbol, maxLogLength);

        this.startFetching();
    }

    async fetchCryptoData() {
        try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${this.symbol}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching data for ${this.symbol}:`, error);
            return null;
        }
    }

    async startFetching() {
        await this.fileManager.readLogFile();
        setInterval(async () => {
            const data = await this.fetchCryptoData();
            if (data) {
                await this.fileManager.addLog(data);
            }
        }, this.operationDelay);
    }
}

module.exports = CryptoData;
