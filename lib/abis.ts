export const BVCC_WALLET_FACTORY_ABI = [
  {
    "type": "function",
    "name": "createWallet",
    "inputs": [
      { "name": "pubKeyX", "type": "uint256", "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "wallet", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getWalletAddress",
    "inputs": [
      { "name": "pubKeyX", "type": "uint256", "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isDeployed",
    "inputs": [
      { "name": "wallet", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "WalletCreated",
    "inputs": [
      { "name": "wallet", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pubKeyX", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
] as const

/**
 * Pre-V4 factories emitted the credential in their own creation event, which was never
 * authenticated: whoever deployed an address could publish any string for it. V4 moved it
 * to CredentialSet, emitted by the wallet inside the passkey-signed call that sets the
 * guardians. Wallets created before V4 still only have the old event, so both are read.
 */
export const LEGACY_WALLET_CREATED_ABI = [
  {
    "type": "event",
    "name": "WalletCreated",
    "inputs": [
      { "name": "wallet", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pubKeyX", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "credentialId", "type": "string", "indexed": false, "internalType": "string" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentWalletCreated",
    "inputs": [
      { "name": "wallet", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pubKeyX", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "credentialId", "type": "string", "indexed": false, "internalType": "string" }
    ],
    "anonymous": false
  }
] as const

export const BVCC_WALLET_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "qx", "type": "bytes32", "internalType": "bytes32" },
      { "name": "qy", "type": "bytes32", "internalType": "bytes32" }
    ],
    "stateMutability": "nonpayable"
  },
  { "type": "receive", "stateMutability": "payable" },
  {
    "type": "function",
    "name": "BVCC_FEE_WALLET",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approveRecovery",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      { "name": "fields", "type": "bytes1", "internalType": "bytes1" },
      { "name": "name", "type": "string", "internalType": "string" },
      { "name": "version", "type": "string", "internalType": "string" },
      { "name": "chainId", "type": "uint256", "internalType": "uint256" },
      { "name": "verifyingContract", "type": "address", "internalType": "address" },
      { "name": "salt", "type": "bytes32", "internalType": "bytes32" },
      { "name": "extensions", "type": "uint256[]", "internalType": "uint256[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "entryPoint",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IEntryPoint" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      { "name": "mode", "type": "bytes32", "internalType": "bytes32" },
      { "name": "executionData", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "executeRecovery",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getNonce",
    "inputs": [{ "name": "key", "type": "uint192", "internalType": "uint192" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getNonce",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "guardians",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasApprovedRecovery",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initiateRecovery",
    "inputs": [
      { "name": "newX", "type": "uint256", "internalType": "uint256" },
      { "name": "newY", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isValidSignature",
    "inputs": [
      { "name": "hash", "type": "bytes32", "internalType": "bytes32" },
      { "name": "signature", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "result", "type": "bytes4", "internalType": "bytes4" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onERC1155BatchReceived",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "uint256[]", "internalType": "uint256[]" },
      { "name": "", "type": "uint256[]", "internalType": "uint256[]" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bytes4", "internalType": "bytes4" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onERC1155Received",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "uint256", "internalType": "uint256" },
      { "name": "", "type": "uint256", "internalType": "uint256" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bytes4", "internalType": "bytes4" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onERC721Received",
    "inputs": [
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "address", "internalType": "address" },
      { "name": "", "type": "uint256", "internalType": "uint256" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bytes4", "internalType": "bytes4" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pendingNewSignerX",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pendingNewSignerY",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recoveryApprovals",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recoveryInProgress",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recoveryReadyAt",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelRecovery",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setGuardians",
    "inputs": [
      { "name": "_guardians", "type": "address[3]", "internalType": "address[3]" },
      { "name": "credentialId", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCredentialId",
    "inputs": [
      { "name": "newCredentialId", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CredentialSet",
    "inputs": [
      { "name": "credentialHash", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "credentialId", "type": "bytes", "indexed": false, "internalType": "bytes" }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "RecoveryActive", "inputs": [] },
  { "type": "error", "name": "InvalidGuardian", "inputs": [] },
  {
    "type": "function",
    "name": "signer",
    "inputs": [],
    "outputs": [
      { "name": "qx", "type": "bytes32", "internalType": "bytes32" },
      { "name": "qy", "type": "bytes32", "internalType": "bytes32" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "supportsExecutionMode",
    "inputs": [{ "name": "mode", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "result", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [{ "name": "interfaceId", "type": "bytes4", "internalType": "bytes4" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "validateUserOp",
    "inputs": [
      {
        "name": "userOp",
        "type": "tuple",
        "internalType": "struct PackedUserOperation",
        "components": [
          { "name": "sender", "type": "address", "internalType": "address" },
          { "name": "nonce", "type": "uint256", "internalType": "uint256" },
          { "name": "initCode", "type": "bytes", "internalType": "bytes" },
          { "name": "callData", "type": "bytes", "internalType": "bytes" },
          { "name": "accountGasLimits", "type": "bytes32", "internalType": "bytes32" },
          { "name": "preVerificationGas", "type": "uint256", "internalType": "uint256" },
          { "name": "gasFees", "type": "bytes32", "internalType": "bytes32" },
          { "name": "paymasterAndData", "type": "bytes", "internalType": "bytes" },
          { "name": "signature", "type": "bytes", "internalType": "bytes" }
        ]
      },
      { "name": "userOpHash", "type": "bytes32", "internalType": "bytes32" },
      { "name": "missingAccountFunds", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ERC7579TryExecuteFail",
    "inputs": [
      { "name": "batchExecutionIndex", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "returndata", "type": "bytes", "indexed": false, "internalType": "bytes" }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "AccountUnauthorized", "inputs": [{ "name": "sender", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "ERC7579DecodingError", "inputs": [] },
  { "type": "error", "name": "ERC7579UnsupportedExecType", "inputs": [{ "name": "execType", "type": "bytes1", "internalType": "bytes1" }] },
  { "type": "error", "name": "FailedCall", "inputs": [] },
  { "type": "error", "name": "InvalidShortString", "inputs": [] },
  { "type": "error", "name": "OutOfRangeAccess", "inputs": [] },
  { "type": "error", "name": "SignerP256InvalidPublicKey", "inputs": [{ "name": "qx", "type": "bytes32", "internalType": "bytes32" }, { "name": "qy", "type": "bytes32", "internalType": "bytes32" }] },
  { "type": "error", "name": "StringTooLong", "inputs": [{ "name": "str", "type": "string", "internalType": "string" }] },
  { "type": "error", "name": "UnsupportedExecutionMode", "inputs": [] }
] as const

// walletType() — shared by both BVCCWallet and BVCCAgentWallet
// Returns 0 (STANDARD) or 1 (AGENT)
export const WALLET_TYPE_ABI = [
  {
    "type": "function",
    "name": "walletType",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "pure"
  }
] as const

export const BVCC_AGENT_WALLET_FACTORY_ABI = [
  {
    "type": "function",
    "name": "createWallet",
    "inputs": [
      { "name": "pubKeyX", "type": "uint256", "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "wallet", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getWalletAddress",
    "inputs": [
      { "name": "pubKeyX", "type": "uint256", "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isDeployed",
    "inputs": [
      { "name": "wallet", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AgentWalletCreated",
    "inputs": [
      { "name": "wallet", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pubKeyX", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
] as const

// AgentPermission tuple order (from getAgentPermission return):
// (maxPerTxWei, dailyLimitWei, totalBudgetWei, totalSpentWei,
//  periodBudgetWei, periodSpentWei,
//  allowedTokens[], tokenMaxAmounts[], tokenDailyLimits[], tokenTotalBudgets[],
//  allowedProtocols[], allowedRecipients[],
//  expiry, periodDuration, periodStart, active)
export const BVCC_AGENT_WALLET_ABI = [
  // Agent custom errors (selectors confirmed on-chain via eth_call probes against the
  // deployed wallet; contract source is not in this repo). Adding them lets viem decode
  // agent-protection reverts instead of showing "unknown reason".
  { "type": "error", "name": "ExceedsPerTxLimit", "inputs": [] },        // 0x34305581 — ETH amount > maxPerTxWei
  { "type": "error", "name": "DailyLimitExceeded", "inputs": [] },       // 0x194bd314 — ETH daily cumulative > dailyLimitWei
  { "type": "error", "name": "ExceedsTokenMaxAmount", "inputs": [] },    // 0xe72e13de — token amount > tokenMaxAmounts
  { "type": "error", "name": "TokenDailyLimitExceeded", "inputs": [] },  // 0x4535941f — token daily cumulative > tokenDailyLimits
  { "type": "error", "name": "TokenNotAllowed", "inputs": [] },          // 0xa29c4986 — token not in allowedTokens
  { "type": "error", "name": "NotAuthorizedAgent", "inputs": [] },       // 0x50699b39 — caller is not an active agent
  { "type": "error", "name": "AgentCannotCallWallet", "inputs": [] },    // 0x852d39d2 — agent may not target the wallet itself (blocks owner-fn self-call escalation)
  // V3 call-policy errors (Case 3 default-deny + arg pinning + deep validation)
  { "type": "error", "name": "SelectorNotAllowed", "inputs": [] },       // selector has no call policy registered
  { "type": "error", "name": "PinnedArgMismatch", "inputs": [] },        // a pinned calldata word is not the wallet / a whitelisted protocol
  { "type": "error", "name": "CalldataTooShort", "inputs": [] },
  { "type": "error", "name": "PolicyValidationFailed", "inputs": [] },   // deep validator (e.g. Universal Router) denied the call
  { "type": "error", "name": "OnlyWallet", "inputs": [] },
  { "type": "error", "name": "ReentrantAgentExecute", "inputs": [] },     // V4: no external execute() while an agent batch is in flight
  { "type": "error", "name": "TokenCallWithValue", "inputs": [] },        // V4: transfer/approve must not carry ETH
  { "type": "error", "name": "AgentMustBeEOA", "inputs": [] },            // V4: re-checked on every execution, not only at authorization
  { "type": "error", "name": "RecoveryActive", "inputs": [] },            // V4: guardians cannot be rotated mid-recovery
  {
    "type": "function",
    "name": "setCallPolicy",
    "inputs": [
      { "name": "target", "type": "address", "internalType": "address" },
      { "name": "selector", "type": "bytes4", "internalType": "bytes4" },
      { "name": "policy", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getCallPolicy",
    "inputs": [
      { "name": "target", "type": "address", "internalType": "address" },
      { "name": "selector", "type": "bytes4", "internalType": "bytes4" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "walletType",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "authorizeAgent",
    "inputs": [
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct BVCCAgentWalletV1.AuthorizeParams",
        "components": [
          { "name": "agent", "type": "address", "internalType": "address" },
          { "name": "maxPerTxWei", "type": "uint128", "internalType": "uint128" },
          { "name": "dailyLimitWei", "type": "uint128", "internalType": "uint128" },
          { "name": "totalBudgetWei", "type": "uint128", "internalType": "uint128" },
          { "name": "periodBudgetWei", "type": "uint128", "internalType": "uint128" },
          { "name": "periodDuration", "type": "uint64", "internalType": "uint64" },
          { "name": "expiry", "type": "uint64", "internalType": "uint64" },
          { "name": "allowedTokens", "type": "address[]", "internalType": "address[]" },
          { "name": "tokenMaxAmounts", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "tokenDailyLimits", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "tokenTotalBudgets", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "allowedProtocols", "type": "address[]", "internalType": "address[]" },
          { "name": "allowedRecipients", "type": "address[]", "internalType": "address[]" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pauseAgents",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unpauseAgents",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "revokeAgent",
    "inputs": [
      { "name": "agent", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "increaseBudget",
    "inputs": [
      { "name": "agent", "type": "address", "internalType": "address" },
      { "name": "additionalWei", "type": "uint128", "internalType": "uint128" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAgentPermission",
    "inputs": [
      { "name": "agent", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct BVCCAgentWalletV1.AgentPermission",
        "components": [
          { "name": "maxPerTxWei", "type": "uint128", "internalType": "uint128" },
          { "name": "dailyLimitWei", "type": "uint128", "internalType": "uint128" },
          { "name": "totalBudgetWei", "type": "uint128", "internalType": "uint128" },
          { "name": "totalSpentWei", "type": "uint128", "internalType": "uint128" },
          { "name": "periodBudgetWei", "type": "uint128", "internalType": "uint128" },
          { "name": "periodSpentWei", "type": "uint128", "internalType": "uint128" },
          { "name": "allowedTokens", "type": "address[]", "internalType": "address[]" },
          { "name": "tokenMaxAmounts", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "tokenDailyLimits", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "tokenTotalBudgets", "type": "uint128[]", "internalType": "uint128[]" },
          { "name": "allowedProtocols", "type": "address[]", "internalType": "address[]" },
          { "name": "allowedRecipients", "type": "address[]", "internalType": "address[]" },
          { "name": "expiry", "type": "uint64", "internalType": "uint64" },
          { "name": "periodDuration", "type": "uint64", "internalType": "uint64" },
          { "name": "periodStart", "type": "uint64", "internalType": "uint64" },
          { "name": "active", "type": "bool", "internalType": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAgents",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "address[]", "internalType": "address[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDailySpent",
    "inputs": [
      { "name": "agent", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "", "type": "uint128", "internalType": "uint128" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTokenSpent",
    "inputs": [
      { "name": "agent", "type": "address", "internalType": "address" },
      { "name": "token", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "dailySpent", "type": "uint128", "internalType": "uint128" },
      { "name": "totalSpent", "type": "uint128", "internalType": "uint128" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "executeAsAgent",
    "inputs": [
      { "name": "mode", "type": "bytes32", "internalType": "bytes32" },
      { "name": "executionData", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AgentAuthorized",
    "inputs": [
      { "name": "agent", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "maxPerTxWei", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "dailyLimitWei", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "totalBudgetWei", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "periodBudgetWei", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "periodDuration", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "expiry", "type": "uint64", "indexed": false, "internalType": "uint64" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentRevoked",
    "inputs": [
      { "name": "agent", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentBudgetIncreased",
    "inputs": [
      { "name": "agent", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "additionalWei", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "newTotalBudget", "type": "uint128", "indexed": false, "internalType": "uint128" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentsPaused",
    "inputs": [
      { "name": "by", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentsUnpaused",
    "inputs": [
      { "name": "by", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AgentExecution",
    "inputs": [
      { "name": "agent", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "ethSpent", "type": "uint128", "indexed": false, "internalType": "uint128" },
      { "name": "dayIndex", "type": "uint32", "indexed": false, "internalType": "uint32" },
      { "name": "totalSpentWei", "type": "uint128", "indexed": false, "internalType": "uint128" }
    ],
    "anonymous": false
  }
] as const

// ── V5 ───────────────────────────────────────────────────────────────────────
// One factory contract serves both wallet types (each deployment clones its own logic).
// The passkey key travels as bytes32, and creating a wallet needs a passkey signature
// over its credential id (see lib/walletGeneration.ts).
export const BVCC_WALLET_FACTORY_V5_ABI = [
  {
    type: 'function',
    name: 'createWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pubKeyX', type: 'bytes32' },
      { name: 'pubKeyY', type: 'bytes32' },
      { name: 'credentialId', type: 'bytes' },
      { name: 'credentialSig', type: 'bytes' },
    ],
    outputs: [{ name: 'wallet', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getWalletAddress',
    stateMutability: 'view',
    inputs: [
      { name: 'pubKeyX', type: 'bytes32' },
      { name: 'pubKeyY', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isDeployed',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/** V5 wallet calls whose shape differs from V4. */
export const BVCC_WALLET_V5_ABI = [
  {
    type: 'function',
    name: 'setGuardians',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newGuardians', type: 'address[3]' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'credentialId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'guardians',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[3]' }],
  },
  {
    type: 'function',
    name: 'armedRecovery',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'proposalId', type: 'bytes32' }, { name: 'readyAt', type: 'uint256' }],
  },
  // Guardian recovery (V5: votes per proposal).
  {"type": "function", "name": "RECOVERY_DELAY", "inputs": [], "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "cancelRecovery", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "executeRecovery", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "recoveryProposal", "inputs": [{"name": "id", "type": "bytes32"}], "outputs": [{"name": "", "type": "tuple", "components": [{"name": "x", "type": "bytes32"}, {"name": "y", "type": "bytes32"}, {"name": "credentialId", "type": "bytes"}]}], "stateMutability": "view"},
  {"type": "function", "name": "recoveryVotes", "inputs": [], "outputs": [{"name": "", "type": "bytes32[3]"}], "stateMutability": "view"},
  {"type": "function", "name": "signer", "inputs": [], "outputs": [{"name": "qx", "type": "bytes32"}, {"name": "qy", "type": "bytes32"}], "stateMutability": "view"},
  {"type": "function", "name": "voteRecovery", "inputs": [{"name": "newX", "type": "bytes32"}, {"name": "newY", "type": "bytes32"}, {"name": "newCredentialId", "type": "bytes"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "walletType", "inputs": [], "outputs": [{"name": "", "type": "uint8"}], "stateMutability": "pure"},
  {"type": "function", "name": "withdrawRecoveryVote", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "error", "name": "AlreadyVoted", "inputs": []},
  {"type": "error", "name": "InvalidPublicKey", "inputs": []},
  {"type": "error", "name": "NoRecoveryArmed", "inputs": []},
  {"type": "error", "name": "NoVote", "inputs": []},
  {"type": "error", "name": "NotGuardian", "inputs": []},
  {"type": "error", "name": "RecoveryActive", "inputs": []},
  {"type": "error", "name": "TimelockNotExpired", "inputs": []},
] as const

/**
 * V5 agent wallet: agent functions, events and errors, generated from the compiled
 * BVCCAgentWalletV5 and BVCCAgentLogicV5. The owner functions it shares with the
 * standard wallet (execute, getNonce...) stay in BVCC_WALLET_ABI.
 */
export const BVCC_AGENT_WALLET_V5_ABI = [
  {"type": "function", "name": "VALIDATOR_REGISTRY", "inputs": [], "outputs": [{"name": "", "type": "address"}], "stateMutability": "view"},
  {"type": "function", "name": "authorizeAgent", "inputs": [{"name": "p", "type": "tuple", "components": [{"name": "agent", "type": "address"}, {"name": "maxPerTxWei", "type": "uint128"}, {"name": "dailyLimitWei", "type": "uint128"}, {"name": "totalBudgetWei", "type": "uint128"}, {"name": "periodBudgetWei", "type": "uint128"}, {"name": "periodDuration", "type": "uint64"}, {"name": "expiry", "type": "uint64"}, {"name": "allowedTokens", "type": "address[]"}, {"name": "tokenMaxAmounts", "type": "uint128[]"}, {"name": "tokenDailyLimits", "type": "uint128[]"}, {"name": "tokenTotalBudgets", "type": "uint128[]"}, {"name": "allowedProtocols", "type": "address[]"}, {"name": "allowedRecipients", "type": "address[]"}]}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "executeAsAgent", "inputs": [{"name": "mode", "type": "bytes32"}, {"name": "executionData", "type": "bytes"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "getAgentCallPolicy", "inputs": [{"name": "agent", "type": "address"}, {"name": "target", "type": "address"}, {"name": "selector", "type": "bytes4"}], "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "getAgentPermission", "inputs": [{"name": "agent", "type": "address"}], "outputs": [{"name": "", "type": "tuple", "components": [{"name": "maxPerTxWei", "type": "uint128"}, {"name": "dailyLimitWei", "type": "uint128"}, {"name": "totalBudgetWei", "type": "uint128"}, {"name": "periodBudgetWei", "type": "uint128"}, {"name": "periodDuration", "type": "uint64"}, {"name": "expiry", "type": "uint64"}, {"name": "active", "type": "bool"}, {"name": "paused", "type": "bool"}, {"name": "allowedTokens", "type": "address[]"}, {"name": "tokenMaxAmounts", "type": "uint128[]"}, {"name": "tokenDailyLimits", "type": "uint128[]"}, {"name": "tokenTotalBudgets", "type": "uint128[]"}, {"name": "allowedProtocols", "type": "address[]"}, {"name": "allowedRecipients", "type": "address[]"}]}], "stateMutability": "view"},
  {"type": "function", "name": "getAgentSpending", "inputs": [{"name": "agent", "type": "address"}], "outputs": [{"name": "", "type": "tuple", "components": [{"name": "totalSpentWei", "type": "uint128"}, {"name": "periodSpentWei", "type": "uint128"}, {"name": "periodStart", "type": "uint64"}]}], "stateMutability": "view"},
  {"type": "function", "name": "getAgentValueSet", "inputs": [{"name": "agent", "type": "address"}, {"name": "target", "type": "address"}, {"name": "selector", "type": "bytes4"}], "outputs": [{"name": "", "type": "bytes32[]"}], "stateMutability": "view"},
  {"type": "function", "name": "getAgents", "inputs": [], "outputs": [{"name": "", "type": "address[]"}], "stateMutability": "view"},
  {"type": "function", "name": "getDailySpent", "inputs": [{"name": "agent", "type": "address"}], "outputs": [{"name": "", "type": "uint128"}], "stateMutability": "view"},
  {"type": "function", "name": "getTokenSpent", "inputs": [{"name": "agent", "type": "address"}, {"name": "token", "type": "address"}], "outputs": [{"name": "daily", "type": "uint128"}, {"name": "total", "type": "uint128"}], "stateMutability": "view"},
  {"type": "function", "name": "increaseBudget", "inputs": [{"name": "agent", "type": "address"}, {"name": "additionalWei", "type": "uint128"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "isTargetBlocked", "inputs": [{"name": "target", "type": "address"}], "outputs": [{"name": "", "type": "bool"}], "stateMutability": "view"},
  {"type": "function", "name": "pauseAgent", "inputs": [{"name": "agent", "type": "address"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "pauseAgents", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "paused", "inputs": [], "outputs": [{"name": "", "type": "bool"}], "stateMutability": "view"},
  {"type": "function", "name": "renewAgent", "inputs": [{"name": "agent", "type": "address"}, {"name": "newExpiry", "type": "uint64"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "revokeAgent", "inputs": [{"name": "agent", "type": "address"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "setAgentCallPolicy", "inputs": [{"name": "agent", "type": "address"}, {"name": "target", "type": "address"}, {"name": "selector", "type": "bytes4"}, {"name": "policy", "type": "uint256"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "setAgentValueSet", "inputs": [{"name": "agent", "type": "address"}, {"name": "target", "type": "address"}, {"name": "selector", "type": "bytes4"}, {"name": "values", "type": "bytes32[]"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "setTargetBlocked", "inputs": [{"name": "target", "type": "address"}, {"name": "blocked", "type": "bool"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "unpauseAgent", "inputs": [{"name": "agent", "type": "address"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "unpauseAgents", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "walletType", "inputs": [], "outputs": [{"name": "", "type": "uint8"}], "stateMutability": "pure"},
  {"type": "event", "name": "AgentAuthorized", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "maxPerTxWei", "type": "uint128", "indexed": false}, {"name": "dailyLimitWei", "type": "uint128", "indexed": false}, {"name": "totalBudgetWei", "type": "uint128", "indexed": false}, {"name": "periodBudgetWei", "type": "uint128", "indexed": false}, {"name": "periodDuration", "type": "uint64", "indexed": false}, {"name": "expiry", "type": "uint64", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentBudgetIncreased", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "additionalWei", "type": "uint128", "indexed": false}, {"name": "newTotalBudget", "type": "uint128", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentCallPolicySet", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "target", "type": "address", "indexed": true}, {"name": "selector", "type": "bytes4", "indexed": true}, {"name": "policy", "type": "uint256", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentExecution", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "ethCharged", "type": "uint256", "indexed": false}, {"name": "ethFee", "type": "uint256", "indexed": false}, {"name": "tokens", "type": "address[]", "indexed": false}, {"name": "tokenCharges", "type": "uint256[]", "indexed": false}, {"name": "tokenFees", "type": "uint256[]", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentPausedSet", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "paused", "type": "bool", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentRenewed", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "expiry", "type": "uint64", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentRevoked", "inputs": [{"name": "agent", "type": "address", "indexed": true}], "anonymous": false},
  {"type": "event", "name": "AgentValueSetUpdated", "inputs": [{"name": "agent", "type": "address", "indexed": true}, {"name": "target", "type": "address", "indexed": true}, {"name": "selector", "type": "bytes4", "indexed": true}, {"name": "values", "type": "bytes32[]", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "AgentsPaused", "inputs": [], "anonymous": false},
  {"type": "event", "name": "AgentsUnpaused", "inputs": [], "anonymous": false},
  {"type": "event", "name": "CredentialSet", "inputs": [{"name": "credentialHash", "type": "bytes32", "indexed": true}, {"name": "credentialId", "type": "bytes", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "EIP712DomainChanged", "inputs": [], "anonymous": false},
  {"type": "event", "name": "GuardiansSet", "inputs": [{"name": "guardians", "type": "address[3]", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "Initialized", "inputs": [{"name": "version", "type": "uint64", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "Paused", "inputs": [{"name": "account", "type": "address", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "RecoveryArmed", "inputs": [{"name": "proposalId", "type": "bytes32", "indexed": true}, {"name": "readyAt", "type": "uint256", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "RecoveryCancelled", "inputs": [], "anonymous": false},
  {"type": "event", "name": "RecoveryDisarmed", "inputs": [{"name": "proposalId", "type": "bytes32", "indexed": true}], "anonymous": false},
  {"type": "event", "name": "RecoveryExecuted", "inputs": [{"name": "proposalId", "type": "bytes32", "indexed": true}, {"name": "newX", "type": "bytes32", "indexed": false}, {"name": "newY", "type": "bytes32", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "RecoveryVoteWithdrawn", "inputs": [{"name": "guardian", "type": "address", "indexed": true}, {"name": "proposalId", "type": "bytes32", "indexed": true}], "anonymous": false},
  {"type": "event", "name": "RecoveryVoted", "inputs": [{"name": "guardian", "type": "address", "indexed": true}, {"name": "proposalId", "type": "bytes32", "indexed": true}, {"name": "newX", "type": "bytes32", "indexed": false}, {"name": "newY", "type": "bytes32", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "TargetBlocked", "inputs": [{"name": "target", "type": "address", "indexed": true}, {"name": "blocked", "type": "bool", "indexed": false}], "anonymous": false},
  {"type": "event", "name": "Unpaused", "inputs": [{"name": "account", "type": "address", "indexed": false}], "anonymous": false},
  {"type": "error", "name": "AccountUnauthorized", "inputs": [{"name": "sender", "type": "address"}]},
  {"type": "error", "name": "AgentCannotCallWallet", "inputs": []},
  {"type": "error", "name": "AgentMustBeEOA", "inputs": []},
  {"type": "error", "name": "AgentPaused", "inputs": []},
  {"type": "error", "name": "AgentPermissionsExpired", "inputs": []},
  {"type": "error", "name": "AlreadyVoted", "inputs": []},
  {"type": "error", "name": "ArrayLengthMismatch", "inputs": []},
  {"type": "error", "name": "BudgetOverflow", "inputs": []},
  {"type": "error", "name": "CallNeedsValidator", "inputs": []},
  {"type": "error", "name": "CalldataTooShort", "inputs": []},
  {"type": "error", "name": "DailyLimitExceeded", "inputs": []},
  {"type": "error", "name": "ERC7579DecodingError", "inputs": []},
  {"type": "error", "name": "ETHFeeFailed", "inputs": []},
  {"type": "error", "name": "EnforcedPause", "inputs": []},
  {"type": "error", "name": "ExceedsPerTxLimit", "inputs": []},
  {"type": "error", "name": "ExpectedPause", "inputs": []},
  {"type": "error", "name": "FeeTransferFailed", "inputs": []},
  {"type": "error", "name": "InsufficientBalanceForFee", "inputs": []},
  {"type": "error", "name": "InvalidAgent", "inputs": []},
  {"type": "error", "name": "InvalidCredentialSignature", "inputs": []},
  {"type": "error", "name": "InvalidExpiry", "inputs": []},
  {"type": "error", "name": "InvalidGuardian", "inputs": []},
  {"type": "error", "name": "InvalidInitialization", "inputs": []},
  {"type": "error", "name": "InvalidPolicy", "inputs": []},
  {"type": "error", "name": "InvalidPublicKey", "inputs": []},
  {"type": "error", "name": "InvalidShortString", "inputs": []},
  {"type": "error", "name": "MeasurementFailed", "inputs": []},
  {"type": "error", "name": "NoRecoveryArmed", "inputs": []},
  {"type": "error", "name": "NoVote", "inputs": []},
  {"type": "error", "name": "NotAuthorizedAgent", "inputs": []},
  {"type": "error", "name": "NotGuardian", "inputs": []},
  {"type": "error", "name": "NotInitializing", "inputs": []},
  {"type": "error", "name": "OnlyWallet", "inputs": []},
  {"type": "error", "name": "OutOfRangeAccess", "inputs": []},
  {"type": "error", "name": "PeriodBudgetExceeded", "inputs": []},
  {"type": "error", "name": "PinnedArgMismatch", "inputs": []},
  {"type": "error", "name": "PolicyValidationFailed", "inputs": []},
  {"type": "error", "name": "PostCheckFailed", "inputs": []},
  {"type": "error", "name": "ProtocolNotAllowed", "inputs": []},
  {"type": "error", "name": "RecipientNotAllowed", "inputs": []},
  {"type": "error", "name": "RecoveryActive", "inputs": []},
  {"type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": []},
  {"type": "error", "name": "ReentrantAgentExecute", "inputs": []},
  {"type": "error", "name": "SafeERC20FailedOperation", "inputs": [{"name": "token", "type": "address"}]},
  {"type": "error", "name": "SelectorNotAllowed", "inputs": []},
  {"type": "error", "name": "SignerP256InvalidPublicKey", "inputs": [{"name": "qx", "type": "bytes32"}, {"name": "qy", "type": "bytes32"}]},
  {"type": "error", "name": "StringTooLong", "inputs": [{"name": "str", "type": "string"}]},
  {"type": "error", "name": "TargetIsBlocked", "inputs": []},
  {"type": "error", "name": "TimelockNotExpired", "inputs": []},
  {"type": "error", "name": "TokenBatchLimitExceeded", "inputs": []},
  {"type": "error", "name": "TokenCallFailed", "inputs": []},
  {"type": "error", "name": "TokenCallWithValue", "inputs": []},
  {"type": "error", "name": "TokenDailyLimitExceeded", "inputs": []},
  {"type": "error", "name": "TokenNotAllowed", "inputs": []},
  {"type": "error", "name": "TokenTotalBudgetExceeded", "inputs": []},
  {"type": "error", "name": "TooManyMeasuredTokens", "inputs": []},
  {"type": "error", "name": "TooManyProtocols", "inputs": []},
  {"type": "error", "name": "TooManyRecipients", "inputs": []},
  {"type": "error", "name": "TooManyTokens", "inputs": []},
  {"type": "error", "name": "TooManyValues", "inputs": []},
  {"type": "error", "name": "TotalBudgetExceeded", "inputs": []},
  {"type": "error", "name": "UnknownAgent", "inputs": []},
  {"type": "error", "name": "UnsupportedExecutionMode", "inputs": []},
  {"type": "error", "name": "ZeroAddress", "inputs": []},
  {"type": "error", "name": "ZeroAmount", "inputs": []},
] as const
