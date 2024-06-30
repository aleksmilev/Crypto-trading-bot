import Event from './event';
import EventHandler from './event_handler';
import { promises as fs } from 'fs';
import path from 'path';

class EventMarket {
    eventList: EventHandler[] = [];
    filePath: string;

    constructor() {
        this.filePath = path.join(__dirname, '../../logs', 'event_market.json');

        (async () => {
            await this.initializeFile();

            while (true) {
                await this.checkForUpdates();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        })();
    }

    async initializeFile(): Promise<void> {
        try {
            await fs.access(this.filePath);
        } catch (error : any) {
            if (error.code === 'ENOENT') {
                await this.writeEventsToFile([]);
            } else {
                console.error('Error checking file existence:', error);
            }
        } finally {
            await this.resetEventMarketFile();
        }
    }

    async resetEventMarketFile(): Promise<void> {
        try {
            await this.writeEventsToFile([]);
        } catch (error) {
            console.error('Error resetting event market file:', error);
        }
    }

    addEventListener(name: string, callback: Function): void {
        this.eventList.push(new EventHandler(name, callback));
    }

    async executeEvent(name: string, data: any): Promise<void> {
        const eventsToExecute = this.eventList.filter(event => event.name == name);    
        for (const eventHandler of eventsToExecute) {
            eventHandler.callback(data);
        }
    }

    async checkForUpdates(): Promise<void> {
        try {
            const events = await this.readEventsFromFile();
            for (const event of events) {
                if (this.eventList.some(e => e.name === event.name)) {
                    await this.executeEvent(event.name, event.data);
                    await this.removeEventById(event.id);
                }
            }
        } catch (error) {
            this.handleFileReadError(error);
        }
    }

    async readEventsFromFile(): Promise<Event[]> {
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data || '[]');
    }

    async writeEventsToFile(events: Event[]): Promise<void> {
        await fs.writeFile(this.filePath, JSON.stringify(events, null, 2), 'utf8');
    }

    async removeEventById(id: string): Promise<void> {
        try {
            const events = await this.readEventsFromFile();
            const updatedEvents = events.filter(event => event.id !== id);
            await this.writeEventsToFile(updatedEvents);
        } catch (error) {
            console.error('Error removing event by ID:', error);
        }
    }

    async emitEvent(name: string, data: any): Promise<void> {
        const newEvent = new Event(name, data);

        try {
            const events = await this.readEventsFromFile();
            events.push(newEvent);
            await this.writeEventsToFile(events);
        } catch (error : any) {
            if (error.code === 'ENOENT') {
                await this.writeEventsToFile([newEvent]);
            } else {
                console.error('Error emitting event:', error);
            }
        }
    }

    handleFileReadError(error: any): void {
        if (error.code === 'ENOENT') {
            console.log('Event file not found, skipping check.');
        } else {
            console.error('Error reading event file:', error);
        }
    }
}

export default EventMarket;
