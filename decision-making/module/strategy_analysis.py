import pandas as pd
from .base_analysis.py import BaseAnalysis

class StrategyAnalysis(BaseAnalysis):
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
