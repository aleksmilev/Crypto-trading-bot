import { promises as fs } from 'fs';
import path from 'path';
import zlib from 'zlib';
import util from 'util';

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

interface CryptoLog {
    [key: string]: any;
    timestamp: string;
}

class FileManager {
    filePath: string;
    maxLogLength: number;
    symbol: string;
    eventMarket: any;
    fullLogs: boolean;
    log: CryptoLog[];

    constructor(symbol: string, maxLogLength: number, eventMarket: any) {
        this.filePath = path.join(__dirname, '../../logs/crypto', `${symbol}_data.json.gz`);
        this.maxLogLength = maxLogLength;
        this.symbol = symbol;
        this.eventMarket = eventMarket;
        this.ensureDirectoryExistence();

        this.fullLogs = false;
        this.log = [];
    }

    async ensureDirectoryExistence(): Promise<void> {
        const dir = path.dirname(this.filePath);
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    }

    async readLogFile(): Promise<void> {
        try {
            const data = await fs.readFile(this.filePath);
            const decompressedData = await gunzip(data);
            this.log = JSON.parse(decompressedData.toString());
        } catch (error : any) {
            if (error.code === 'ENOENT') {
                await this.createLogFile();
            } else {
                console.error(`Error reading log file ${this.filePath}:`, error);
            }
        }
    }

    async createLogFile(): Promise<void> {
        try {
            await fs.writeFile(this.filePath, await gzip(JSON.stringify([])));
            this.log = [];
        } catch (error) {
            console.error(`Error creating log file ${this.filePath}:`, error);
        }
    }

    async addLog(data: any): Promise<void> {
        data.timestamp = new Date().toISOString();
        this.log.push(data);

        if (this.log.length > this.maxLogLength) {
            this.log.shift();

            if (!this.fullLogs) {
                this.fullLogs = true;
                this.eventMarket.emitEvent('logsReady', this.symbol);
                console.log(`Finished collecting start data for: ${this.symbol}`);
            }
        }

        await this.saveLogFile();
    }

    async saveLogFile(): Promise<void> {
        try {
            const compressedData = await gzip(JSON.stringify(this.log, null, 2));
            await fs.writeFile(this.filePath, compressedData);
        } catch (error) {
            console.error(`Error saving log file ${this.filePath}:`, error);
        }
    }
}

export default FileManager;
