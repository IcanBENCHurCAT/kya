/**
 * Algorand Client — connects to Algorand nodes and indexers
 * Provides methods to query transactions, accounts, and asset data
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

    // Configure Algod client
    const algodServer = this.config.nodeURL || DEFAULT_CONFIG.nodeURL;
    const algodPort = this.config.port || DEFAULT_CONFIG.port;
    const algodToken = this.config.token || '';

    this.algod = new algosdk.Algodv2(algodToken, algodServer, algodPort);

    // Configure Indexer client
    const indexerServer = this.config.indexerURL || DEFAULT_CONFIG.indexerURL;
    const indexerPort = this.config.indexerPort || DEFAULT_CONFIG.indexerPort;
    const indexerToken = this.config.indexerToken || DEFAULT_CONFIG.indexerToken;

    this.indexer = new algosdk.Indexer(indexerToken, indexerServer, indexerPort);
  }

  /**
   * Get current network parameters
   */
  async getNetworkParams(): Promise<algosdk.NodeStatusResponse> {
    const status = await this.algod.status().do();
    return status;
  }

  /**
   * Get account information including balance and assets
   */
  async getAccountInfo(address: string): Promise<algosdk.AccountInformation> {
    const response = await this.indexer.lookupAccountByID(parseInt(address)).do();
    return response;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionByID(txID: string): Promise<algosdk.PendingTransactionResponse> {
    return this.algod.getTxById(txID).do();
  }

  /**
   * Query all transactions for an address (incoming and outgoing)
   * Uses the Algorand Indexer API for comprehensive transaction history
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
    const limit = options?.limit ?? 100;
    const params: Record<string, string | number> = {
      limit: limit.toString(),
    };

    if (options?.beforeRound) {
      params['before-round'] = options.beforeRound.toString();
    }
    if (options?.afterRound) {
      params['after-round'] = options.afterRound.toString();
    }
    if (options?.minAmount) {
      params['min-amount'] = options.minAmount.toString();
    }
    if (options?.maxAmount) {
      params['max-amount'] = options.maxAmount.toString();
    }
    if (options?.assetId) {
      params['asset-id'] = options.assetId.toString();
    }
    if (options?.startTime) {
      params['start-time'] = new Date(options.startTime).toISOString();
    }
    if (options?.endTime) {
      params['end-time'] = new Date(options.endTime).toISOString();
    }

    const response = await this.indexer
      .lookupAccountTransactions(address)
      .params(params)
      .do();

    return this.parseTransactions(response.transactions);
  }

  /**
   * Query pending transactions for an address
   */
  async getPendingTransactionsByAddress(
    address: string
  ): Promise<algosdk.PendingTransactionResponse[]> {
    const response = await this.indexer
      .lookupAccountTransactions(address)
      .addressRole('sender')
      .do();

    return response.transactions || [];
  }

  /**
   * Query transactions by application ID (smart contract interactions)
   */
  async getTransactionsByApplication(
    appID: number,
    options?: { limit?: number; beforeRound?: number; afterRound?: number }
  ): Promise<AlgorandTransaction[]> {
    const limit = options?.limit ?? 100;
    const params: Record<string, string | number> = {
      'application-id': appID.toString(),
      limit: limit.toString(),
    };

    if (options?.beforeRound) {
      params['before-round'] = options.beforeRound.toString();
    }
    if (options?.afterRound) {
      params['after-round'] = options.afterRound.toString();
    }

    const response = await this.indexer
      .lookupApplicationTransactionsByApplicationID(appID)
      .params(params)
      .do();

    return this.parseTransactions(response.transactions);
  }

  /**
   * Query asset transactions (opt-in, transfer, opt-out)
   */
  async getAssetTransactions(
    assetId: number,
    options?: { limit?: number }
  ): Promise<AlgorandTransaction[]> {
    const limit = options?.limit ?? 100;
    const params: Record<string, string | number> = {
      'asset-id': assetId.toString(),
      limit: limit.toString(),
    };

    const response = await this.indexer
      .lookupAssetTransactions(assetId)
      .params(params)
      .do();

    return this.parseTransactions(response.transactions);
  }

  /**
   * Get current round number
   */
  async getCurrentRound(): Promise<number> {
    const status = await this.algod.status().do();
    return status.lastRound;
  }

  /**
   * Search for accounts by asset balance
   */
  async searchAccountsByAsset(assetId: number): Promise<{ accounts: algosdk.AccountInformation[] }> {
    const response = await this.indexer
      .searchForAccounts()
      .assetId(assetId)
      .do();

    return response;
  }

  /**
   * Search for accounts by min balance
   */
  async searchAccountsByMinBalance(minBalance: number): Promise<{ accounts: algosdk.AccountInformation[] }> {
    const response = await this.indexer
      .searchForAccounts()
      .minBalance(minBalance)
      .do();

    return response;
  }

  /**
   * Look up asset by ID
   */
  async getAssetByID(assetId: number): Promise<{ asset: { params: { name: string; 'decimals': number; 'total': number } } }> {
    const response = await this.indexer.lookupAssetByID(assetId).do();
    return response;
  }

  /**
   * Look up block by round
   */
  async getBlockByRound(round: number): Promise<algosdk.BlockResponse> {
    return this.algod.block(round).do();
  }

  /**
   * Internal: Parse raw transaction results into our structured format
   */
  private parseTransactions(
    rawTransactions: algosdk.types.TransactionResult[]
  ): AlgorandTransaction[] {
    if (!rawTransactions) {
      return [];
    }

    return rawTransactions.map((tx) => {
      const result = tx.tx;
      if (!result) {
        return null;
      }

      // Determine transaction type
      let txType: 'sent' | 'received' | 'application' = 'sent';
      let appCall: AlgorandTransaction['applicationCall'] = undefined;
      let assetTransfer: AlgorandTransaction['assetTransfer'] = undefined;

      if (result.tx && result.tx.appCallTxnFields) {
        txType = 'application';
        appCall = {
          type: this.mapOnCompletion(result.tx.appCallTxnFields.onCompletion) || 'NoOp',
          applicationId: result.tx.appCallTxnFields.applicationID,
          onCompletion: result.tx.appCallTxnFields.onCompletion,
        };
      } else if (result.tx && result.tx.assetTransferTxnFields) {
        assetTransfer = {
          assetId: result.tx.assetTransferTxnFields.assetIndex,
          amount: result.tx.assetTransferTxnFields.amount,
          receiver: result.tx.assetTransferTxnFields.assetReceiver,
          sender: result.tx.assetTransferTxnFields.assetSender,
          closeTo: result.tx.assetTransferTxnFields.assetCloseTo,
        };

        // Determine if this is a send or receive for the watched address
        if (assetTransfer.receiver === result.tx.snd) {
          txType = 'received';
        } else {
          txType = 'sent';
        }
      } else {
        // Regular payment transaction
        const paymentTxnFields = result.tx.paymentTxnFields;
        if (paymentTxnFields) {
          if (paymentTxnFields.receiver === result.tx.snd) {
            // Payment to self (close remainder)
            txType = 'sent';
          } else {
            txType = result.tx.snd === paymentTxnFields.sender ? 'sent' : 'received';
          }
        }
      }

      const amount = result.tx.amount || 0;
      const fee = result.tx.fee || 0;
      const round = result.confirmedRound || 0;
      const timestamp = result['block-time'] || 0;

      // Get the primary sender and receiver
      const sender = result.tx.snd || '';
      let receiver = '';
      if (result.tx.paymentTxnFields) {
        receiver = result.tx.paymentTxnFields.receiver;
      }

      return {
        txid: result.txid || '',
        round,
        timestamp,
        sender,
        receiver,
        amount,
        fee,
        type: txType,
        note: result.tx.note ? Buffer.from(result.tx.note).toString('base64') : undefined,
        closeRemainderTo: result.tx.paymentTxnFields?.closeRemainderTo,
        assetTransfer,
        applicationCall: appCall,
        blockHash: result.blockHash,
        confirmations: 0, // Will be calculated externally
      };
    }).filter((tx): tx is AlgorandTransaction => tx !== null);
  }

  private mapOnCompletion(value: string): string {
    const map: Record<string, string> = {
      'noop': 'NoOp',
      'optin': 'OptIn',
      'closeout': 'CloseOut',
      'clearstate': 'ClearState',
      'updateapplication': 'UpdateApplication',
      'deleteapplication': 'DeleteApplication',
    };
    return map[value.toLowerCase()] || value;
  }
}
