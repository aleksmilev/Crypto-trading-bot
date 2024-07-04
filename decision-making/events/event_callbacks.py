import os
import asyncio
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from analysis.base_analysis import BaseAnalysis

class EventCallbacks:
    event_market = None

    @staticmethod
    def set_event_market(event_market):
        EventCallbacks.event_market = event_market

    @staticmethod
    async def logs_ready_callback(data):
        symbol = data
        log_file_path = os.path.join('logs', 'crypto', f'{symbol}_data.json.gz')

        class FileChangeHandler(FileSystemEventHandler):
            def __init__(self, symbol, log_file_path, loop):
                super().__init__()
                self.symbol = symbol
                self.log_file_path = log_file_path
                self.loop = loop
                self.last_emit_time = None
                self.emit_interval = 10  # Adjust as needed

                self.base_analysis = BaseAnalysis(
                        config_file='/usr/src/app/config.json',
                        crypto=self.symbol,
                        event_market=EventCallbacks.event_market
                    )

            def on_modified(self, event):
                if event.src_path == self.log_file_path and not event.is_directory:
                    now = time.time()
                    if self.last_emit_time is None or now - self.last_emit_time > self.emit_interval:
                        asyncio.run_coroutine_threadsafe(self.process_log_file(), self.loop)
                        self.last_emit_time = now

            async def process_log_file(self):
                await EventCallbacks.event_market.emit_event("print", f"Test: {self.symbol} : 1")

                try:
                    await EventCallbacks.event_market.emit_event("print", f"Test: {self.symbol} : 2")

                    decision, trade_amount = await self.base_analysis.decide_trade_amount()

                    await EventCallbacks.event_market.emit_event("print", f"Test: {decision} , {trade_amount} : 3")

                    message = f"{self.symbol}={decision.upper()}:{trade_amount:.2f}"
                    await EventCallbacks.event_market.emit_event("print", f"Decision for {self.symbol}: {message}")

                except Exception as e:
                    await EventCallbacks.event_market.emit_event("print", f"Error processing {self.symbol}: {str(e)}")

        event_handler = FileChangeHandler(symbol, log_file_path, asyncio.get_running_loop())
        observer = Observer()
        observer.schedule(event_handler, Path(log_file_path).parent, recursive=False)
        observer.start()

        try:
            while True:
                await asyncio.sleep(3600)
        except KeyboardInterrupt:
            observer.stop()
            observer.join()
