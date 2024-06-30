import json
import gzip
import pandas as pd
from pathlib import Path
from transformers import BertTokenizer, BertForSequenceClassification
import torch

class AnalysisModule:
    def __init__(self, config_file, symbol, event_market):
        self.symbol = symbol
        self.config = self.load_config(config_file)
        self.strategies = self.config['strategies']
        self.trading_settings = self.get_trading_settings(symbol)
        self.data_path = Path(__file__).parent.parent / 'logs' / 'crypto' / f'{symbol}_data.json.gz'
        self.tokenizer = BertTokenizer.from_pretrained('../module/module')
        self.model = BertForSequenceClassification.from_pretrained('../module/module', num_labels=3)
        self.model.eval()
        self.event_market = event_market
        self.account_data = None

    def load_config(self, config_file):
        with open(config_file, 'r') as f:
            return json.load(f)
    
    def get_trading_settings(self, symbol):
        for setting in self.config['trading_settings']:
            if setting['symbol'] == symbol:
                return setting
        return None
    
    def load_data(self):
        with gzip.open(self.data_path, 'rt') as f:
            data = json.loads(f.read())
        return pd.DataFrame(data)
    
    def analyze_data_with_strategies(self, data):
        actions = set()
        for strategy in self.strategies:
            if strategy['name'] == "Simple Moving Average (SMA) Crossover":
                actions.add(self.sma_crossover_strategy(data, strategy['parameters']))
            elif strategy['name'] == "Relative Strength Index (RSI)":
                actions.add(self.rsi_strategy(data, strategy['parameters']))
            elif strategy['name'] == "MACD":
                actions.add(self.macd_strategy(data, strategy['parameters']))
            elif strategy['name'] == "Bollinger Bands":
                actions.add(self.bollinger_bands_strategy(data, strategy['parameters']))
        return actions
    
    def sma_crossover_strategy(self, data, parameters):
        short_window = parameters['short_window']
        long_window = parameters['long_window']
        if short_window > len(data) or long_window > len(data):
            return "hold"
        data['SMA_short'] = data['close'].rolling(window=short_window).mean()
        data['SMA_long'] = data['close'].rolling(window=long_window).mean()
        if data['SMA_short'].iloc[-1] > data['SMA_long'].iloc[-1]:
            return "buy"
        elif data['SMA_short'].iloc[-1] < data['SMA_long'].iloc[-1]:
            return "sell"
        return "hold"
    
    def rsi_strategy(self, data, parameters):
        period = parameters['period']
        if period > len(data):
            return "hold"
        delta = data['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        if rsi.iloc[-1] > parameters['overbought']:
            return "sell"
        elif rsi.iloc[-1] < parameters['oversold']:
            return "buy"
        return "hold"
    
    def macd_strategy(self, data, parameters):
        short_window = parameters['short_window']
        long_window = parameters['long_window']
        signal_window = parameters['signal_window']
        if short_window > len(data) or long_window > len(data) or signal_window > len(data):
            return "hold"
        short_ema = data['close'].ewm(span=short_window, adjust=False).mean()
        long_ema = data['close'].ewm(span=long_window, adjust=False).mean()
        macd = short_ema - long_ema
        signal = macd.ewm(span=signal_window, adjust=False).mean()
        if macd.iloc[-1] > signal.iloc[-1]:
            return "buy"
        elif macd.iloc[-1] < signal.iloc[-1]:
            return "sell"
        return "hold"
    
    def bollinger_bands_strategy(self, data, parameters):
        period = parameters['period']
        if period > len(data):
            return "hold"
        sma = data['close'].rolling(window=period).mean()
        std = data['close'].rolling(window=period).std()
        upper_band = sma + (std * parameters['deviation'])
        lower_band = sma - (std * parameters['deviation'])
        if data['close'].iloc[-1] > upper_band.iloc[-1]:
            return "sell"
        elif data['close'].iloc[-1] < lower_band.iloc[-1]:
            return "buy"
        return "hold"
    
    def analyze_data_with_ai(self, data):
        inputs = self.tokenizer(data['close'].astype(str).tolist(), return_tensors='pt', padding=True, truncation=True)
        with torch.no_grad():
            outputs = self.model(**inputs)
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(probabilities, dim=-1).item()
        return ["hold", "buy", "sell"][predicted_class]
    
    def make_decision(self):
        data = self.load_data()
        strategy_actions = self.analyze_data_with_strategies(data)
        ai_action = self.analyze_data_with_ai(data)
        combined_action = self.combine_actions(strategy_actions, ai_action)
        return combined_action
    
    def combine_actions(self, strategy_actions, ai_action):
        actions = strategy_actions.union({ai_action})
        if "buy" in actions:
            return "buy"
        elif "sell" in actions:
            return "sell"
        return "hold"
    
    def make_transaction_decision(self, event_market):
        max_quantity = self.trading_settings['max_quantity']
        decision = self.make_decision()
        total_balance = sum(float(balance['free']) for balance in self.account_data['balances'])
        crypto_balance = next((float(balance['free']) for balance in self.account_data['balances'] if balance['asset'] == self.symbol), 0)
        
        if decision == "buy":
            amount_to_buy = min(max_quantity, total_balance)
            self.event_market.emit_event("print", f"{self.symbol}-buy-{amount_to_buy}")
            print(f"{self.symbol}-buy-{amount_to_buy}")
        elif decision == "sell":
            amount_to_sell = min(max_quantity, crypto_balance)
            self.event_market.emit_event("print", f"{self.symbol}-sell-{amount_to_sell}")
            print(f"{self.symbol}-sell-{amount_to_sell}")

    def handle_logs_ready_event(self):
        self.make_transaction_decision()

    def register_events(self):
        self.event_market.add_event_listener('logsReady', lambda data: self.handle_logs_ready_event())

    
