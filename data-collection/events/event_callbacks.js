const AccountData = require('../account/account_data');

class EventCallbacks {
    static async fetchAccountData(params) {
        console.log('Received fetchAccountData event');
        AccountData.updateAccountData();
    }
}

module.exports = EventCallbacks;