import AccountData from '../account/account_data';

class EventCallbacks {
    static async fetchAccountData(params: any): Promise<void> {
        console.log('Received fetchAccountData event');
        await AccountData.updateAccountData();
    }
}

export default EventCallbacks;
