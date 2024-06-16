import torch
from .base_analysis import BaseAnalysis

class AIAnalysis(BaseAnalysis):
    def analyze_data_with_ai(self, data):
        inputs = self.tokenizer(data['close'].astype(str).tolist(), return_tensors='pt', padding=True, truncation=True)
        with torch.no_grad():
            outputs = self.model(**inputs)
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(probabilities, dim=-1).item()
        return ["hold", "buy", "sell"][predicted_class]
