import json
import os
import time
from pathlib import Path
from events.event import Event
from events.event_handler import EventHandler
from events.event_callbacks import EventCallbacks

class EventMarket:
    def __init__(self):
        self.event_list = []
        self.file_path = Path(__file__).parent.parent / 'logs' / 'event_market.json'
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_file()

    def _initialize_file(self):
        if not self.file_path.exists() or self.file_path.stat().st_size == 0:
            with open(self.file_path, 'w') as f:
                json.dump([], f)

    def add_event_listener(self, name, callback):
        self.event_list.append(EventHandler(name, callback))

    def emit_event(self, name, data):
        new_event = Event(name, data)
        try:
            events = self._read_events_from_file()
            events.append(new_event.__dict__)
            self._write_events_to_file(events)
        except Exception as e:
            print(f"Error emitting event: {e}")

    def _read_events_from_file(self):
        with open(self.file_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

    def _write_events_to_file(self, events):
        with open(self.file_path, 'w') as f:
            json.dump(events, f, indent=2)

    def _remove_event_by_id(self, event_id):
        events = self._read_events_from_file()
        events = [event for event in events if event['id'] != event_id]
        self._write_events_to_file(events)

    def check_for_updates(self):
        events = self._read_events_from_file()
        for event in events:
            for handler in self.event_list:
                if handler.name == event['name']:
                    handler.callback(event['data'])
                    self._remove_event_by_id(event['id'])

    def start(self, interval=1):
        while True:
            self.check_for_updates()
            time.sleep(interval)
