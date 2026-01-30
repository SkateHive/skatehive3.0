import { Client, Operation } from '@hiveio/dhive';
import { HiveAccountKeys } from './keyGeneration';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';

/**
 * Hive client for account creation operations
 * Uses multiple API nodes for redundancy
 */
const client = new Client(SPONSORSHIP_CONFIG.HIVE_API_NODES);

/**
 * Result of an account creation attempt
 */
export interface AccountCreationResult {
  success: boolean;
  username: string;
  transactionId?: string;
  error?: string;
  blockNumber?: number;
}

/**
 * Builds an account_create operation for Keychain to sign
 * This operation will be sent to Hive Keychain for the sponsor to sign
 *
 * @param sponsorUsername - Username of the sponsor (who pays and signs)
 * @param newUsername - Username for the new account
 * @param keys - Generated keys for the new account
 * @param fee - Cost in HIVE (default: 3.000 HIVE)
 * @param recoveryAccount - Recovery account (default: from config)
 * @returns account_create operation ready for Keychain
 *
 * @example
 * const keys = generateHiveKeys('newuser');
 * const operation = buildAccountCreateOperation('sponsor', 'newuser', keys);
 * // Pass operation to Keychain for signing
 */
export function buildAccountCreateOperation(
  sponsorUsername: string,
  newUsername: string,
  keys: HiveAccountKeys,
  fee: string = '3.000 HIVE',
  recoveryAccount?: string
): Operation {
  const recovery = recoveryAccount || SPONSORSHIP_CONFIG.DEFAULT_RECOVERY_ACCOUNT;

  const operation: Operation = [
    'account_create',
    {
      fee,
      creator: sponsorUsername,
      new_account_name: newUsername,
      owner: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.ownerPublic, 1]],
      },
      active: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.activePublic, 1]],
      },
      posting: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.postingPublic, 1]],
      },
      memo_key: keys.memoPublic,
      json_metadata: JSON.stringify({
        profile: {
          name: newUsername,
          about: 'Account created via Skatehive sponsorship',
          profile_image: '', // Will be set by user later
          cover_image: '',
          website: 'https://skatehive.app',
        },
        skatehive: {
          sponsored: true,
          version: '1.0',
          created_via: 'skatehive_sponsorship',
        },
      }),
    },
  ];

  return operation;
}

/**
 * Checks if a Hive username is available (not already taken)
 *
 * @param username - Username to check
 * @returns true if available, false if taken
 *
 * @example
 * const available = await isUsernameAvailable('skatehive');
 * if (!available) {
 *   console.log('Username already taken');
 * }
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const accounts = await client.database.getAccounts([username]);
    return accounts.length === 0;
  } catch (error) {
    console.error('Error checking username availability:', error);
    // On error, assume taken to be safe
    return false;
  }
}

/**
 * Verifies that a transaction was successfully included in the blockchain
 *
 * @param transactionId - The transaction ID to verify
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 2000)
 * @returns Transaction details if found, null if not found
 *
 * @example
 * const tx = await verifyTransaction('abc123...');
 * if (tx) {
 *   console.log('Transaction confirmed in block', tx.blockNumber);
 * }
 */
export async function verifyTransaction(
  transactionId: string,
  maxRetries: number = 5,
  retryDelay: number = 2000
): Promise<{
  blockNumber: number;
  transactionNum: number;
  confirmed: boolean;
} | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get transaction info from blockchain
      const tx = await client.database.call('get_transaction', [transactionId]);

      if (tx && tx.block_num) {
        return {
          blockNumber: tx.block_num,
          transactionNum: tx.transaction_num,
          confirmed: true,
        };
      }
    } catch (error) {
      // Transaction not found yet, will retry
      console.log(`Transaction ${transactionId} not found, attempt ${attempt + 1}/${maxRetries}`);
    }

    // Wait before retrying (except on last attempt)
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return null;
}

/**
 * Verifies that an account was successfully created
 *
 * @param username - Username to verify
 * @returns Account data if exists, null if not found
 *
 * @example
 * const account = await verifyAccountCreated('newuser');
 * if (account) {
 *   console.log('Account created at', account.created);
 * }
 */
export async function verifyAccountCreated(username: string): Promise<any | null> {
  try {
    const accounts = await client.database.getAccounts([username]);

    if (accounts.length > 0) {
      return accounts[0];
    }

    return null;
  } catch (error) {
    console.error('Error verifying account creation:', error);
    return null;
  }
}

/**
 * Gets detailed information about a Hive account
 *
 * @param username - Username to fetch
 * @returns Account data or null if not found
 */
export async function getAccount(username: string): Promise<any | null> {
  try {
    const accounts = await client.database.getAccounts([username]);
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error fetching account:', error);
    return null;
  }
}

/**
 * Checks if a user has enough Hive Power to sponsor accounts
 *
 * @param username - Username to check
 * @param minHP - Minimum HP required (default: from config)
 * @returns true if user has enough HP
 *
 * @example
 * const canSponsor = await canUserSponsor('sponsor123');
 * if (!canSponsor) {
 *   console.log('Insufficient Hive Power to sponsor');
 * }
 */
export async function canUserSponsor(
  username: string,
  minHP: number = SPONSORSHIP_CONFIG.SPONSOR_MIN_HP
): Promise<boolean> {
  try {
    const account = await getAccount(username);

    if (!account) {
      return false;
    }

    // Calculate Hive Power (VESTS to HP conversion)
    // HP = VESTS * total_vesting_fund_hive / total_vesting_shares
    const props = await client.database.getDynamicGlobalProperties();
    const vestingShares = parseFloat(account.vesting_shares);
    const totalVestingFund = parseFloat(props.total_vesting_fund_hive);
    const totalVestingShares = parseFloat(props.total_vesting_shares);

    const hp = (vestingShares * totalVestingFund) / totalVestingShares;

    return hp >= minHP;
  } catch (error) {
    console.error('Error checking sponsor eligibility:', error);
    return false;
  }
}

/**
 * Estimates the current account creation fee
 * This can fluctuate based on HIVE price and witness settings
 *
 * @returns Estimated fee in HIVE
 */
export async function estimateAccountCreationFee(): Promise<number> {
  try {
    const props = await client.database.getChainProperties();
    const fee = props.account_creation_fee;

    // Parse fee string like "3.000 HIVE"
    const amount = parseFloat(fee.split(' ')[0]);
    return amount;
  } catch (error) {
    console.error('Error estimating account creation fee:', error);
    // Return default if unable to fetch
    return SPONSORSHIP_CONFIG.COST_HIVE;
  }
}

/**
 * Validates that a transaction contains an account_create operation
 * for the expected username
 *
 * @param transactionId - Transaction ID to check
 * @param expectedUsername - Username that should be created
 * @returns true if transaction creates the expected account
 */
export async function validateAccountCreationTransaction(
  transactionId: string,
  expectedUsername: string
): Promise<boolean> {
  try {
    const tx = await client.database.call('get_transaction', [transactionId]);

    if (!tx || !tx.operations) {
      return false;
    }

    // Check if any operation is account_create for the expected username
    for (const op of tx.operations) {
      if (op[0] === 'account_create' && op[1].new_account_name === expectedUsername) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error validating transaction:', error);
    return false;
  }
}

/**
 * Complete verification of account creation
 * Checks both transaction and account existence
 *
 * @param transactionId - Transaction ID from Keychain
 * @param username - Username that should have been created
 * @returns Detailed verification result
 */
export async function verifyAccountCreationComplete(
  transactionId: string,
  username: string
): Promise<AccountCreationResult> {
  try {
    // Step 1: Verify transaction exists
    const tx = await verifyTransaction(transactionId);

    if (!tx) {
      return {
        success: false,
        username,
        error: 'Transaction not found on blockchain',
      };
    }

    // Step 2: Validate transaction contains correct account_create
    const isValid = await validateAccountCreationTransaction(transactionId, username);

    if (!isValid) {
      return {
        success: false,
        username,
        transactionId,
        error: 'Transaction does not create the expected account',
      };
    }

    // Step 3: Verify account exists
    const account = await verifyAccountCreated(username);

    if (!account) {
      return {
        success: false,
        username,
        transactionId,
        blockNumber: tx.blockNumber,
        error: 'Account not found after transaction confirmation',
      };
    }

    // Success!
    return {
      success: true,
      username,
      transactionId,
      blockNumber: tx.blockNumber,
    };
  } catch (error: any) {
    return {
      success: false,
      username,
      transactionId,
      error: error.message || 'Unknown error during verification',
    };
  }
}
