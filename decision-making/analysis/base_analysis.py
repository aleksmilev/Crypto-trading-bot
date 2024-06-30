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
        self.tokenizer = BertTokenizer.from_pretrained('./local_model/bert-base-uncased')
        self.model = BertForSequenceClassification.from_pretrained('./local_model/bert-base-uncased', num_labels=3)
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
