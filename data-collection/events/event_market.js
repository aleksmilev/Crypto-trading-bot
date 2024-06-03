const Event = require('./event');
const EventHandler = require('./event_handler');
const fs = require('fs').promises;
const path = require('path');

class EventMarker {
    eventList = [];

    constructor() {
        this.filePath = path.join(__dirname, '../../logs', 'event_marker.json');

        (async () => {
            while (true) {
                await this.checkForUpdates();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        })();
    }

    addEventListener(name, callback) {
        this.eventList.push(new EventHandler(name, callback));
    }

    async executeEvent(name, data) {
        const eventHandler = this.eventList.find(event => event.name === name);
        if (eventHandler) {
            eventHandler.callback(data);
            this.eventList = this.eventList.filter(event => event.name !== name);
        }
    }

    async checkForUpdates() {
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

    async readEventsFromFile() {
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data || '[]');
    }

    async writeEventsToFile(events) {
        await fs.writeFile(this.filePath, JSON.stringify(events, null, 2), 'utf8');
    }

    async removeEventById(id) {
        try {
            const events = await this.readEventsFromFile();
            const updatedEvents = events.filter(event => event.id !== id);
            await this.writeEventsToFile(updatedEvents);
        } catch (error) {
            console.error('Error removing event by ID:', error);
        }
    }

    async emitEvent(name, data) {
        const newEvent = new Event(name, data);

        try {
            const events = await this.readEventsFromFile();
            events.push(newEvent);
            await this.writeEventsToFile(events);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.writeEventsToFile([newEvent]);
            } else {
                console.error('Error emitting event:', error);
            }
        }
    }

    handleFileReadError(error) {
        if (error.code === 'ENOENT') {
            console.log('Event file not found, skipping check.');
        } else {
            console.error('Error reading event file:', error);
        }
    }
}

module.exports = EventMarker;
