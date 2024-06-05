import uuid

class Event:
    def __init__(self, name, data):
        self.id = str(uuid.uuid4())
        self.name = name
        self.data = data

    def __repr__(self):
        return f"Event(id={self.id}, name={self.name}, data={self.data})"
