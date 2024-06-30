import asyncio
from events.event_market import EventMarket
from events.event_callbacks import EventCallbacks

async def main():
    event_market = EventMarket()
    await event_market.emit_event("print", "Decision-making is ready!")
    event_market.add_event_listener('logsReady', EventCallbacks.logs_ready_callback)
    await event_market.start()

if __name__ == "__main__":
    asyncio.run(main())
