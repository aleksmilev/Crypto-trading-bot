from events.event_market import EventMarket
from events.event_callbacks import EventCallbacks


def main():
    event_market = EventMarket()
    event_market.add_event_listener("logsReady", EventCallbacks.print_logs_ready)
    event_market.start()

if __name__ == "__main__":
    main()
