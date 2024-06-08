from events.event_market import EventMarket

def main():
    event_market = EventMarket()
    event_market.emit_event("print", "Decision-making is ready!")
    event_market.start()


if __name__ == "__main__":
    main()
