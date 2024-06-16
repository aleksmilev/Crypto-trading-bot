import { v4 as uuidv4 } from 'uuid';

class Event {
    id: string;
    name: string;
    data: any;

    constructor(name: string, data: any) {
        this.id = uuidv4();
        this.name = name;
        this.data = data;
    }
}

export default Event;
