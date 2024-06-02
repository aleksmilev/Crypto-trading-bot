# import time
# import os
# from threading import Thread

# class Events:
#     @staticmethod
#     def eventMarkerListener(events):
#         def listener():
#             event_marker_path = "/usr/src/app/logs/event_marker.txt"
#             while True:
#                 if os.path.exists(event_marker_path):
#                     with open(event_marker_path, 'r') as file:
#                         content = file.read().strip()
#                         for event_name, callback in events.items():
#                             if content.startswith(event_name):
#                                 os.remove(event_marker_path)
#                                 callback(content)
#                                 break
#                 time.sleep(2)

#         listener_thread = Thread(target=listener)
#         listener_thread.daemon = True
#         listener_thread.start()

# class EventHandling:
#     @staticmethod
#     def logs_ready(content):
#         event, crypto_symbol = content.split(':')
#         print(f"Logs Ready Event Detected for {crypto_symbol}")

#         file_path = f"/usr/src/app/logs/{crypto_symbol}.txt"
#         with open(file_path, "w") as file:
#             file.write(crypto_symbol)
