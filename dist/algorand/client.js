/**
 * Algorand Client — connects to Algorand nodes and indexers
 * Provides methods to query transactions, accounts, and asset data
 *
 * Compatible with algosdk v2.7.x (uses the builder-pattern indexer/algod API)
 */
import * as algosdk from 'algosdk';
import { DEFAULT_CONFIG } from '../types/index.js';
export class AlgorandClient {
    algod;
    indexer;
    config;
    network;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.network = this.config.network;
        // Configure Algod client: Algodv2(token, server, port)
        const algodServer = this.config.nodeURL || DEFAULT_CONFIG.nodeURL;
        const algodPort = this.config.port || '';
        const algodToken = this.config.token || '';
        this.algod = new algosdk.Algodv2(algodToken, algodServer, algodPort);
        // Configure Indexer client: Indexer(token, server, port)
        const indexerServer = this.config.indexerURL || DEFAULT_CONFIG.indexerURL;
        const indexerPort = this.config.indexerPort || '';
        const indexerToken = this.config.indexerToken || '';
        this.indexer = new algosdk.Indexer(indexerToken, indexerServer, indexerPort);
    }
    /**
     * Get current network parameters (node status)
     */
    async getNetworkParams() {
        const status = await this.algod.status().do();
        return status;
    }
    /**
     * Get account information including balance and assets
     */
    async getAccountInfo(address) {
        const response = await this.indexer
            .lookupAccountByID(address)
            .do();
        return response;
    }
    /**
     * Get transaction by ID
     */
    async getTransactionByID(txID) {
        return this.indexer
            .lookupTransactionByID(txID)
            .do();
    }
    /**
     * Query all transactions for an address (incoming and outgoing)
     * Uses the Algorand Indexer API with builder-style query params
     */
    async getTransactionsByAddress(address, options) {
        // Use builder-style API — limit(), minRound(), maxRound(), etc.
        let query = this.indexer
            .lookupAccountTransactions(address)
            .limit(options?.limit ?? 100);
        if (options?.afterRound) {
            query = query.minRound(options.afterRound);
        }
        if (options?.beforeRound) {
            query = query.maxRound(options.beforeRound);
        }
        if (options?.minAmount) {
            query = query.currencyGreaterThan(options.minAmount - 1);
        }
        if (options?.maxAmount) {
            query = query.currencyLessThan(options.maxAmount + 1);
        }
        if (options?.assetId) {
            query = query.assetID(options.assetId);
        }
        if (options?.startTime) {
            query = query.afterTime(new Date(options.startTime).toISOString());
        }
        if (options?.endTime) {
            query = query.beforeTime(new Date(options.endTime).toISOString());
        }
        const response = await query.do();
        return this.parseTransactions(response?.transactions || []);
    }
    /**
     * Query pending transactions for an address
     */
    async getPendingTransactionsByAddress(address) {
        const response = await this.indexer
            .lookupAccountTransactions(address)
            .do();
        return (response?.transactions || []);
    }
    /**
     * Query transactions by application ID (smart contract interactions)
     * Uses the generic searchForTransactions with application-id filter
     */
    async getTransactionsByApplication(appID, options) {
        let query = this.indexer
            .searchForTransactions()
            .applicationID(appID)
            .limit(options?.limit ?? 100);
        if (options?.afterRound) {
            query = query.minRound(options.afterRound);
        }
        if (options?.beforeRound) {
            query = query.maxRound(options.beforeRound);
        }
        const response = await query.do();
        return this.parseTransactions(response?.transactions || []);
    }
    /**
     * Query asset transactions (opt-in, transfer, opt-out)
     */
    async getAssetTransactions(assetId, options) {
        let query = this.indexer
            .lookupAssetTransactions(assetId)
            .limit(options?.limit ?? 100);
        const response = await query.do();
        return this.parseTransactions(response?.transactions || []);
    }
    /**
     * Get current round number
     */
    async getCurrentRound() {
        const status = await this.algod.status().do();
        return status.lastRound || 0;
    }
    /**
     * Search for accounts by asset balance
     */
    async searchAccountsByAsset(assetId) {
        const response = await this.indexer
            .searchAccounts()
            .assetID(assetId)
            .do();
        return response;
    }
    /**
     * Search for accounts by min balance (uses currencyGreaterThan as proxy)
     */
    async searchAccountsByMinBalance(minBalance) {
        const response = await this.indexer
            .searchAccounts()
            .currencyGreaterThan(minBalance)
            .do();
        return response;
    }
    /**
     * Look up asset by ID
     */
    async getAssetByID(assetId) {
        const response = await this.indexer
            .lookupAssetByID(assetId)
            .do();
        return response;
    }
    /**
     * Look up block by round
     */
    async getBlockByRound(round) {
        return this.indexer
            .lookupBlock(round)
            .do();
    }
    /**
     * Internal: Parse raw transaction results into our structured format
     *
     * The algosdk v2.x indexer returns transactions in a nested structure:
     * { transactions: [ { tx: { ... }, ...confirmedRound, ...block-time }, ... ] }
     */
    parseTransactions(rawTransactions) {
        if (!rawTransactions) {
            return [];
        }
        return rawTransactions
            .map((tx) => {
            if (!tx) {
                return null;
            }
            // Determine transaction type
            let txType = 'sent';
            let appCall = undefined;
            let assetTransfer = undefined;
            const txn = tx.tx;
            if (!txn) {
                return null;
            }
            if (txn.appCallTxnFields) {
                txType = 'application';
                appCall = {
                    type: this.mapOnCompletion(txn.appCallTxnFields.onCompletion),
                    applicationId: txn.appCallTxnFields.applicationID,
                    onCompletion: txn.appCallTxnFields.onCompletion,
                };
            }
            else if (txn.assetTransferTxnFields) {
                assetTransfer = {
                    assetId: txn.assetTransferTxnFields.assetIndex,
                    amount: txn.assetTransferTxnFields.amount,
                    receiver: txn.assetTransferTxnFields.assetReceiver,
                    sender: txn.assetTransferTxnFields.assetSender,
                    closeTo: txn.assetTransferTxnFields.assetCloseTo,
                };
                if (assetTransfer.receiver === txn.snd) {
                    txType = 'received';
                }
                else {
                    txType = 'sent';
                }
            }
            else {
                const paymentTxnFields = txn.paymentTxnFields;
                if (paymentTxnFields) {
                    if (paymentTxnFields.receiver === txn.snd) {
                        // Payment to self (close remainder)
                        txType = 'sent';
                    }
                    else {
                        txType =
                            txn.snd === paymentTxnFields.sender
                                ? 'sent'
                                : 'received';
                    }
                }
            }
            const amount = txn.amount || 0;
            const fee = txn.fee || 0;
            const round = tx.confirmedRound || 0;
            const timestamp = tx['block-time'] || 0;
            // Get the primary sender and receiver
            const sender = txn.snd || '';
            let receiver = '';
            if (txn.paymentTxnFields) {
                receiver = txn.paymentTxnFields.receiver;
            }
            return {
                txid: tx.txid || '',
                round,
                timestamp,
                sender,
                receiver,
                amount,
                fee,
                type: txType,
                note: txn.note
                    ? Buffer.from(txn.note).toString('base64')
                    : undefined,
                closeRemainderTo: txn.paymentTxnFields?.closeRemainderTo,
                assetTransfer,
                applicationCall: appCall,
                blockHash: tx.blockHash,
                confirmations: 0,
            };
        })
            .filter((tx) => tx !== null);
    }
    mapOnCompletion(value) {
        const map = {
            noop: 'NoOp',
            optin: 'OptIn',
            closeout: 'CloseOut',
            clearstate: 'ClearState',
            updateapplication: 'UpdateApplication',
            deleteapplication: 'DeleteApplication',
        };
        return (map[value.toLowerCase()] ||
            'NoOp');
    }
}
