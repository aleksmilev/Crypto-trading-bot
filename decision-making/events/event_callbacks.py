import asyncio
import os
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from analysis.analysis_module_beta import AnalysisModule

class EventCallbacks:
    event_market = None

    @staticmethod
    def set_event_market(event_market):
        EventCallbacks.event_market = event_market

    @staticmethod
    async def logs_ready_callback(data):
        symbol = data
        analysis_module = AnalysisModule(
            config_file='/usr/src/app/config.json', 
            symbol=symbol, 
            event_market=EventCallbacks.event_market
        )
        
        log_file_path = os.path.join('logs', 'crypto', f'{symbol}_data.json.gz')

        class FileChangeHandler(FileSystemEventHandler):
            async def on_modified(self, event):
                if event.src_path == log_file_path and not event.is_directory:
                    result = analysis_module.make_decision()
                    trade_amount = analysis_module.trading_settings['max_quantity']
                    message = f"{symbol}={result.upper()}:{trade_amount:.2f}"
                    
                    await EventCallbacks.event_market.emit_event("print", message)

        event_handler = FileChangeHandler()
        observer = Observer()
        observer.schedule(event_handler, Path(log_file_path).parent, recursive=False)
        observer.start()

        try:
            while True:
                await asyncio.sleep(3600)
        except KeyboardInterrupt:
            observer.stop()
            observer.join()
