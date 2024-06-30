
class EventCallbacks:
    event_market = None

    @staticmethod
    def set_event_market(event_market):
        EventCallbacks.event_market = event_market

    @staticmethod
    async def logs_ready_callback(data):
        if EventCallbacks.event_market:
            await EventCallbacks.event_market.emit_event("print", data)
