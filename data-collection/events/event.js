const { v4: uuidv4 } = require('uuid');

class Event {
    constructor(name, data) {
        this.id = uuidv4();
        this.name = name;
        this.data = data;
    }
}

module.exports = Event;