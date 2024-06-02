const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const EventEmitter = require('events');

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

class FileManager extends EventEmitter {
    constructor(symbol, maxLogLength) {
        super();
        
        this.filePath = path.join(__dirname, '../../logs/crypto', `${symbol}_data.json.gz`);
        this.maxLogLength = maxLogLength;
        this.symbol = symbol;
        this.ensureDirectoryExistence();

        this.fullLogs = false;
        this.log = [];
    }

    async ensureDirectoryExistence() {
        const dir = path.dirname(this.filePath);
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    }

    async readLogFile() {
        try {
            const data = await fs.readFile(this.filePath);
            const decompressedData = await gunzip(data);
            this.log = JSON.parse(decompressedData.toString());
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.createLogFile();
            } else {
                console.error(`Error reading log file ${this.filePath}:`, error);
            }
        }
    }

    async createLogFile() {
        try {
            await fs.writeFile(this.filePath, await gzip(JSON.stringify([])));
            this.log = [];
        } catch (error) {
            console.error(`Error creating log file ${this.filePath}:`, error);
        }
    }

    async addLog(data) {
        data.timestamp = new Date().toISOString();
        this.log.push(data);
        
        if (this.log.length > this.maxLogLength) {
            this.log.shift();

            if (!this.fullLogs) {
                this.fullLogs = true;
                this.emit('logsReady', this.symbol);
                // await fs.writeFile(path.join(__dirname, '../../logs', 'event_marker.json'), `logsReady:${this.symbol}`);
                console.log("Finished collecting start data for: " + this.symbol);
            }
        }

        await this.saveLogFile();
    }

    async saveLogFile() {
        try {
            const compressedData = await gzip(JSON.stringify(this.log, null, 2));
            await fs.writeFile(this.filePath, compressedData);
        } catch (error) {
            console.error(`Error saving log file ${this.filePath}:`, error);
        }
    }
}

module.exports = FileManager;
