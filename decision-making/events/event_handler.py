class EventHandler:
    def __init__(self, name, callback):
        self.name = name
        self.callback = callback

    def __repr__(self):
        return f"EventHandler(name={self.name}, callback={self.callback.__name__})"
