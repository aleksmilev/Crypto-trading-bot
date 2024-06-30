import { v4 as uuidv4 } from 'uuid';

class EventHandler {
    id: string;
    name: string;
    callback: Function;

    constructor(name: string, callback: Function) {
        this.id = uuidv4();
        this.name = name;
        this.callback = callback;
    }
}

export default EventHandler;
