export const BVCC_WALLET_FACTORY_ABI = [
  {
    "type": "function",
    "name": "createWallet",
    "inputs": [
      { "name": "pubKeyX", "type": "uint256", "internalType": "uint256" },
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" },
      { "name": "guardians", "type": "address[3]", "internalType": "address[3]" },
      { "name": "credentialId", "type": "string", "internalType": "string" }
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
      { "name": "_guardians", "type": "address[3]", "internalType": "address[3]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
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

// BVCCWalletFactory — Arbitrum Sepolia (chainId 421614)
// v5: fix Case 3 forwarda exec.value al target (swap ETH→token funciona)
export const FACTORY_ADDRESS = '0x6890bCC6F53463cDECAcce3D8bE72bb8fD81F58d' as `0x${string}`

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
      { "name": "pubKeyY", "type": "uint256", "internalType": "uint256" },
      { "name": "guardians", "type": "address[3]", "internalType": "address[3]" },
      { "name": "credentialId", "type": "string", "internalType": "string" }
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
      { "name": "pubKeyY", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "credentialId", "type": "string", "indexed": false, "internalType": "string" }
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
