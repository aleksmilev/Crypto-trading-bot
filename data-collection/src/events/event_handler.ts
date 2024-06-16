class EventHandler {
    name: string;
    callback: Function;

    constructor(name: string, callback: Function) {
        this.name = name;
        this.callback = callback;
    }
}

export default EventHandler;
