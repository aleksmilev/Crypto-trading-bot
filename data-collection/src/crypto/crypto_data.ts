import axios from 'axios';
import FileManager from './crypto_file_manager';

interface CryptoDataResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
}

class CryptoData {
    symbol: string;
    operationDelay: number;
    fileManager: FileManager;

    constructor(symbol: string, maxLogLength: number, operationDelay: number, eventMarket: any) {
        this.symbol = symbol;
        this.operationDelay = operationDelay;
        this.fileManager = new FileManager(symbol, maxLogLength, eventMarket);

        this.startFetching();
    }

    async fetchCryptoData(): Promise<CryptoDataResponse | null> {
        try {
            const response = await axios.get<CryptoDataResponse>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${this.symbol}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching data for ${this.symbol}:`, error);
            return null;
        }
    }

    async startFetching(): Promise<void> {
        await this.fileManager.readLogFile();
        setInterval(async () => {
            const data = await this.fetchCryptoData();
            if (data) {
                await this.fileManager.addLog(data);
            }
        }, this.operationDelay);
    }
}

export default CryptoData;
