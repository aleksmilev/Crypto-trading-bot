const AccountData = require('../account/account_data');

class EventCallbacks {
    static async fetchAccountData(params) {
        console.log('Received fetchAccountData event');
        const accountData = await AccountData.fetchAccountData();
        if (accountData) {
            await AccountData.saveAccountData(accountData);
        }
    }
}

module.exports = EventCallbacks;