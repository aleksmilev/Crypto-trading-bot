from .strategy_analysis import StrategyAnalysis
from .ai_analysis import AIAnalysis
from .utils import Utils
from .config_loader import ConfigLoader

class AnalysisModule:
    def __init__(self, config_file, crypto, event_market):
        self.strategy_analysis = StrategyAnalysis(config_file, crypto, event_market)
        self.ai_analysis = AIAnalysis(config_file, crypto, event_market)
        self.utils = Utils()
        self.crypto = crypto
        self.event_market = event_market

    def make_decision(self):
        data = self.strategy_analysis.load_data()
        strategy_actions = self.strategy_analysis.analyze_data_with_strategies(data)
        ai_action = self.ai_analysis.analyze_data_with_ai(data)
        combined_action = self.utils.combine_actions(strategy_actions, ai_action)
        return combined_action

    def make_transaction_decision(self):
        max_quantity = self.strategy_analysis.trading_settings['max_quantity']
        decision = self.make_decision()
        total_balance = sum(float(balance['free']) for balance in self.strategy_analysis.account_data['balances'])
        crypto_balance = next((float(balance['free']) for balance in self.strategy_analysis.account_data['balances'] if balance['asset'] == self.crypto), 0)
        
        if decision == "buy":
            amount_to_buy = min(max_quantity, total_balance)
            self.event_market.emit_event("print", f"{self.crypto}-buy-{amount_to_buy}", self.crypto)
            print(f"{self.crypto}-buy-{amount_to_buy}")
        elif decision == "sell":
            amount_to_sell = min(max_quantity, crypto_balance)
            self.event_market.emit_event("print", f"{self.crypto}-sell-{amount_to_sell}", self.crypto)
            print(f"{self.crypto}-sell-{amount_to_sell}")

    def handle_logs_ready_event(self, crypto):
        self.strategy_analysis.data_path = Path(__file__).parent.parent / 'logs' / crypto / f'{crypto}_data.json.gz'
        self.make_transaction_decision()

    def register_events(self):
        self.event_market.add_event_listener('logsReady', lambda data, crypto: self.handle_logs_ready_event(crypto))
