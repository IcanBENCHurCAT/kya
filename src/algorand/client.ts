/**
 * Algorand Client — connects to Algorand nodes and indexers
 * Provides methods to query transactions, accounts, and asset data
 *
 * Compatible with algosdk v2.7.x (uses the builder-pattern indexer/algod API)
 */

import * as algosdk from 'algosdk';
import type { AlgorandConfig, AlgorandTransaction } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';

export class AlgorandClient {
  private algod: algosdk.Algodv2;
  private indexer: algosdk.Indexer;
  private config: AlgorandConfig;
  private network: string;

  constructor(config?: Partial<AlgorandConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.network = this.config.network;

    // Configure Algod client: Algodv2(token, server, port)
    const algodServer = this.config.nodeURL || DEFAULT_CONFIG.nodeURL;
    const algodPort = this.config.port || '';
    const algodToken = this.config.token || '';

    this.algod = new algosdk.Algodv2(
      algodToken as string,
      algodServer as string,
      algodPort as string
    );

    // Configure Indexer client: Indexer(token, server, port)
    const indexerServer = this.config.indexerURL || DEFAULT_CONFIG.indexerURL;
    const indexerPort = this.config.indexerPort || '';
    const indexerToken = this.config.indexerToken || '';

    this.indexer = new algosdk.Indexer(
      indexerToken as string,
      indexerServer as string,
      indexerPort as string
    );
  }

  /**
   * Get current network parameters (node status)
   */
  async getNetworkParams(): Promise<{
    lastRound: number;
    version: string;
    timeSinceRound: number;
    caughtUp: boolean;
  }> {
    const status = await this.algod.status().do();
    return status as {
      lastRound: number;
      version: string;
      timeSinceRound: number;
      caughtUp: boolean;
    };
  }

  /**
   * Get account information including balance and assets
   */
  async getAccountInfo(address: string): Promise<Record<string, unknown>> {
    const response = await this.indexer
      .lookupAccountByID(address)
      .do();
    return response as unknown as Record<string, unknown>;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionByID(txID: string): Promise<Record<string, unknown>> {
    return this.indexer
      .lookupTransactionByID(txID)
      .do();
  }

  /**
   * Query all transactions for an address (incoming and outgoing)
   * Uses the Algorand Indexer API with builder-style query params
   */
  async getTransactionsByAddress(
    address: string,
    options?: {
      limit?: number;
      beforeRound?: number;
      afterRound?: number;
      startTime?: number;
      endTime?: number;
      minAmount?: number;
      maxAmount?: number;
      assetId?: number;
    }
  ): Promise<AlgorandTransaction[]> {
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
  async getPendingTransactionsByAddress(
    address: string
  ): Promise<Record<string, unknown>[]> {
    const response = await this.indexer
      .lookupAccountTransactions(address)
      .do();
    return (response?.transactions || []) as unknown as Record<string, unknown>[];
  }

  /**
   * Query transactions by application ID (smart contract interactions)
   * Uses the generic searchForTransactions with application-id filter
   */
  async getTransactionsByApplication(
    appID: number,
    options?: { limit?: number; beforeRound?: number; afterRound?: number }
  ): Promise<AlgorandTransaction[]> {
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
  async getAssetTransactions(
    assetId: number,
    options?: { limit?: number }
  ): Promise<AlgorandTransaction[]> {
    let query = this.indexer
      .lookupAssetTransactions(assetId)
      .limit(options?.limit ?? 100);

    const response = await query.do();
    return this.parseTransactions(response?.transactions || []);
  }

  /**
   * Get current round number
   */
  async getCurrentRound(): Promise<number> {
    const status = await this.algod.status().do();
    return status.lastRound || 0;
  }

  /**
   * Search for accounts by asset balance
   */
  async searchAccountsByAsset(assetId: number): Promise<Record<string, unknown>> {
    const response = await this.indexer
      .searchAccounts()
      .assetID(assetId)
      .do();
    return response as unknown as Record<string, unknown>;
  }

  /**
   * Search for accounts by min balance (uses currencyGreaterThan as proxy)
   */
  async searchAccountsByMinBalance(minBalance: number): Promise<Record<string, unknown>> {
    const response = await this.indexer
      .searchAccounts()
      .currencyGreaterThan(minBalance)
      .do();
    return response as unknown as Record<string, unknown>;
  }

  /**
   * Look up asset by ID
   */
  async getAssetByID(assetId: number): Promise<Record<string, unknown>> {
    const response = await this.indexer
      .lookupAssetByID(assetId)
      .do();
    return response as unknown as Record<string, unknown>;
  }

  /**
   * Look up block by round
   */
  async getBlockByRound(round: number): Promise<Record<string, unknown>> {
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
  private parseTransactions(
    rawTransactions: Record<string, unknown>[]
  ): AlgorandTransaction[] {
    if (!rawTransactions) {
      return [];
    }

    return rawTransactions
      .map((tx): AlgorandTransaction | null => {
        if (!tx) {
          return null;
        }

        // Determine transaction type
        let txType: 'sent' | 'received' | 'application' = 'sent';
        let appCall: AlgorandTransaction['applicationCall'] = undefined;
        let assetTransfer: AlgorandTransaction['assetTransfer'] = undefined;

        const txn = (tx as any).tx;
        if (!txn) {
          return null;
        }

        if ((txn as any).appCallTxnFields) {
          txType = 'application';
          appCall = {
            type: this.mapOnCompletion(
              (txn as any).appCallTxnFields.onCompletion
            ),
            applicationId: (txn as any).appCallTxnFields.applicationID,
            onCompletion: (txn as any).appCallTxnFields.onCompletion,
          };
        } else if ((txn as any).assetTransferTxnFields) {
          assetTransfer = {
            assetId: (txn as any).assetTransferTxnFields.assetIndex,
            amount: (txn as any).assetTransferTxnFields.amount,
            receiver: (txn as any).assetTransferTxnFields.assetReceiver,
            sender: (txn as any).assetTransferTxnFields.assetSender,
            closeTo: (txn as any).assetTransferTxnFields.assetCloseTo,
          };

          if (assetTransfer.receiver === txn.snd) {
            txType = 'received';
          } else {
            txType = 'sent';
          }
        } else {
          const paymentTxnFields = (txn as any).paymentTxnFields;
          if (paymentTxnFields) {
            if (paymentTxnFields.receiver === txn.snd) {
              // Payment to self (close remainder)
              txType = 'sent';
            } else {
              txType =
                txn.snd === paymentTxnFields.sender
                  ? 'sent'
                  : 'received';
            }
          }
        }

        const amount = txn.amount || 0;
        const fee = txn.fee || 0;
        const round = (tx as any).confirmedRound || 0;
        const timestamp = (tx as any)['block-time'] || 0;

        // Get the primary sender and receiver
        const sender = txn.snd || '';
        let receiver = '';
        if ((txn as any).paymentTxnFields) {
          receiver = (txn as any).paymentTxnFields.receiver;
        }

        return {
          txid: (tx as any).txid || '',
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
          closeRemainderTo: (txn as any).paymentTxnFields?.closeRemainderTo,
          assetTransfer,
          applicationCall: appCall,
          blockHash: (tx as any).blockHash,
          confirmations: 0,
        };
      })
      .filter((tx): tx is AlgorandTransaction => tx !== null);
  }

  private mapOnCompletion(
    value: string
  ): 'NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication' {
    const map: Record<
      string,
      'NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication'
    > = {
      noop: 'NoOp',
      optin: 'OptIn',
      closeout: 'CloseOut',
      clearstate: 'ClearState',
      updateapplication: 'UpdateApplication',
      deleteapplication: 'DeleteApplication',
    };
    return (
      map[value.toLowerCase()] ||
      ('NoOp' as 'NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication')
    );
  }
}
