import gzip
import json
from pathlib import Path
import pandas as pd
from transformers import BertTokenizer, BertForSequenceClassification
import torch

class BaseAnalysis:
    def __init__(self, config_file, crypto, event_market):
        self.crypto = crypto
        self.config = self.load_config(config_file)
        self.strategies = self.config['strategies']
        self.trading_settings = self.get_trading_settings(crypto)
        self.data_path = Path(__file__).parent.parent / 'logs' / crypto / f'{crypto}_data.json.gz'
        
        module_path = Path(__file__).parent.parent / 'module' / 'module'
        self.tokenizer = BertTokenizer.from_pretrained(module_path)
        self.model = BertForSequenceClassification.from_pretrained(module_path, num_labels=3)
        self.model.eval()
        
        self.event_market = event_market
        self.account_data = None

    def load_config(self, config_file):
        with open(config_file, 'r') as f:
            return json.load(f)
    
    def get_trading_settings(self, crypto):
        for setting in self.config['trading_settings']:
            if setting['symbol'] == crypto:
                return setting
        return None

    def load_data(self):
        with gzip.open(self.data_path, 'rt') as f:
            data = json.loads(f.read())
        return pd.DataFrame(data)

    def analyze_data_with_ai(self, data):
        inputs = self.tokenizer(data['close'].astype(str).tolist(), return_tensors='pt', padding=True, truncation=True)
        with torch.no_grad():
            outputs = self.model(**inputs)
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(probabilities, dim=-1).item()
        return ["hold", "buy", "sell"][predicted_class]

    def perform_ai_analysis(self, data):
        return self.analyze_data_with_ai(data)

    def make_combined_decision(self):
        data = self.load_data()
        ai_result = self.perform_ai_analysis(data)
        return ai_result

    def calculate_quantity(self, decision, price):
        balance = self.account_data['balance']
        holdings = self.account_data['holdings']

        if decision == "buy":
            max_buyable = balance / price
            return min(max_buyable, self.trading_settings.get('max_trade_size', max_buyable))
        
        elif decision == "sell":
            max_sellable = holdings
            return min(max_sellable, self.trading_settings.get('max_trade_size', max_sellable))
        
        return 0

    def decide_trade_amount(self):
        decision = self.make_combined_decision()
        data = self.load_data()
        latest_price = data.iloc[-1]['close']

        quantity = self.calculate_quantity(decision, latest_price)
        return decision, quantity
