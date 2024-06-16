class Utils:
    @staticmethod
    def combine_actions(strategy_actions, ai_action):
        actions = strategy_actions.union({ai_action})
        if "buy" in actions:
            return "buy"
        elif "sell" in actions:
            return "sell"
        return "hold"
