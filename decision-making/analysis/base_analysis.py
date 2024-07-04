import gzip
import json
from pathlib import Path
import pandas as pd
from transformers import AutoModelForMaskedLM, AutoTokenizer
import torch

class BaseAnalysis:
    def __init__(self, config_file, crypto, event_market):
        self.crypto = crypto
        self.config = self.load_config(config_file)
        self.strategies = self.config['strategies']
        self.trading_settings = self.get_trading_settings(crypto)
        self.data_path = Path(__file__).parent.parent / 'logs' / 'crypto' / f'{crypto}_data.json.gz'

        self.tokenizer = AutoTokenizer.from_pretrained("vedantgoswami/crypto-bert-model")
        self.model = AutoModelForMaskedLM.from_pretrained("vedantgoswami/crypto-bert-model")
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

    async def analyze_data_with_ai(self, data):
        try:
            if data is None or data.empty:
                raise ValueError(f"No data or empty data provided for {self.crypto}.")
            
            # Check for required columns or handle data format appropriately
            if 'close' not in data.columns:
                raise ValueError(f"'close' column not found in data for {self.crypto}")
            
            inputs = self.tokenizer(data['close'].astype(str).tolist(), return_tensors='pt', padding=True, truncation=True)
            with torch.no_grad():
                outputs = self.model(**inputs)
            decision = ["hold", "buy", "sell"][torch.argmax(outputs.logits, dim=-1).item()]
            return decision
        except ValueError as ve:
            await self.event_market.emit_event("print", f"Error analyzing data for {self.crypto}: {str(ve)}")
            return None
        except Exception as e:
            await self.event_market.emit_event("print", f"Error analyzing data for {self.crypto}: {str(e)}")
            return None

    async def decide_trade_amount(self):
        try:
            data = self.load_data()
            decision = await self.analyze_data_with_ai(data)
            if decision is not None:
                trade_amount = self.calculate_quantity(decision, data.iloc[-1]['close'])
                message = f"{self.crypto}={decision.upper()}:{trade_amount:.2f}"
                await self.event_market.emit_event("print", f"Decision for {self.crypto}: {message}")
            else:
                await self.event_market.emit_event("print", f"Error processing {self.crypto}: Analysis failed")
            return decision, trade_amount if decision is not None else None
        except Exception as e:
            await self.event_market.emit_event("print", f"Error processing {self.crypto}: {str(e)}")
            return None, None

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
