# Signing with dApps

How BVCC Wallet decides what to show you before you approve a transaction, and what you
can change at that point.

Implementation: [`lib/wcCalls.ts`](../lib/wcCalls.ts) (decoding and risk) and
[`components/WcConnectModal.tsx`](../components/WcConnectModal.tsx) (the modal).

## The problem this addresses

Approval draining does not need a bug in your wallet. It needs you to sign something you
did not read. The dApp shows a friendly button, the calldata underneath says
`approve(spender, 2^256-1)`, and the wallet renders a target address and a hex string that
nobody checks.

So the wallet decodes the call and states what it does, in a sentence, before the sign
button becomes useful.

## What you see

```
🟢  Swap 0.5 WETH → USDC (min 1,847.2 USDC)
🟢  Deposit 100 USDC into Aave
🟡  Borrow 50 USDC on Aave                  Creates debt on Aave
🔴  Approve USDC UNLIMITED to 0x9f2c…       Approval to an UNKNOWN address
```

Amounts use the token's real symbol and decimals, resolved from the network config, so
`1000000` reads as `1 USDC`. Uniswap v4's native-ETH convention (`address(0)`) is handled.

## Coverage

32 function signatures:

| Area | Decoded |
|---|---|
| ERC-20 | `approve`, `increaseAllowance`, `transfer`, `transferFrom` |
| NFTs | `setApprovalForAll` (both directions) |
| WETH | `deposit`, `withdraw` |
| Aave v3 | `supply`, `withdraw`, `borrow`, `repay` |
| Uniswap v3 | `exactInputSingle`, `exactOutputSingle`, `exactInput`, `exactOutput`, `unwrapWETH9`, `refundETH` |
| Uniswap v3 LP | `mint`, `increaseLiquidity`, `decreaseLiquidity`, `collect`, `burn` |
| Uniswap v4 | `modifyLiquidities`, `modifyLiquiditiesWithoutUnlock` — the action byte and position id are pulled out of the packed encoding |
| Universal Router | `execute` — command bytes are decoded into the individual v2/v3/v4 swaps, wraps and Permit2 steps, then joined |
| Permit2 | `approve(token, spender, amount, expiration)` |
| ENS | `commit`, `register`, `renew` |
| Aggregation | `multicall` — unwrapped up to 2 levels deep and summarized item by item, with the worst sub-risk winning |

## Risk levels

| Level | Meaning | Effect |
|:---:|---|---|
| 🟢 | Recognized, and every address in it is one we know | Sign normally |
| 🟡 | Worth reading — creates debt, moves tokens to a known address, unlimited approval to a *known* contract, or a call that could not be decoded | Shown with the reason |
| 🔴 | Approval or transfer to an address that is not in your address book, your own wallet, or the canonical protocol list | A confirmation box must be ticked before the button unlocks |

Two deliberate choices:

- **Undecodable is 🟡, never 🟢.** If we cannot say what a call does, we say so.
- **Recognized-but-unknown-target is downgraded.** A perfectly normal `exactInputSingle`
  aimed at a router nobody has heard of is 🟡, not 🟢. The action being safe is not the same
  as the destination being safe.

"Known" means: contracts from your address book, your own wallet address, the network's
configured tokens and factories, and a hardcoded list of canonical protocol addresses
(Permit2, Uniswap NFPM / PositionManager / Universal Router, Aave v3 Pool, ENS) across all
six networks.

## Editing an approval

When a dApp requests an unlimited allowance, the modal shows an editable field with the
requested amount. Type what you actually want to grant and the wallet re-encodes the
calldata with `encodeApproveAmount()` before signing. The chain receives your number.

This works for both plain ERC-20 `approve` and Permit2's four-argument form.

## Batching (EIP-5792)

The wallet implements `wallet_sendCalls`, `wallet_getCallsStatus` and
`wallet_getCapabilities`.

**Sequential by default.** A batch is signed one call at a time, Ledger-style, so you see
and approve each step and can stop halfway. Atomic batching — the whole batch in a single
UserOp, all-or-nothing — is opt-in from Settings, because it means one signature covers
calls you have not individually reviewed.

There is also a gas editor with a configurable per-operation cap (3M on Ethereum L1, 8M on
L2s by default) so a mis-estimated batch cannot reserve an absurd prefund.

## Why a smart wallet can sign for a dApp at all (ERC-7739)

An EOA signs with a private key. A smart wallet has no key of its own — it answers
`isValidSignature(hash, sig)` and the dApp trusts the answer. That creates a replay
problem: if the wallet signed the app's hash directly, the same signature could be
replayed against any *other* wallet controlled by the same passkey.

[ERC-7739](https://eips.ethereum.org/EIPS/eip-7739) fixes this by nesting. The app's
message is wrapped in a `TypedDataSign` struct that includes the **verifying wallet's own
EIP-712 domain**, so the digest is bound to one specific contract. Replaying it elsewhere
produces a different digest and fails.

`BVCCSmartWalletV4` inherits OpenZeppelin's `ERC7739`
([`contracts/src/BVCCWallet.sol`](../contracts/src/BVCCWallet.sol)), with the domain
`EIP712("BVCCSmartWalletV4", "1")`.

This is not academic. Uniswap's Permit2 asks for a second signature over a `PermitSingle`,
and without a correct ERC-7739 implementation `isValidSignature` returns `0xffffffff` and
every token→token and token→ETH swap fails.

### The part that is easy to get wrong

The nested digest has to be computed identically in Solidity and in the browser, and there
is a trap: **viem's canonical EIP-712 encoder sorts sub-types alphabetically, while
ERC-7739 concatenates the contents descriptor with the primary type first.** For a
single-struct message both agree. For Permit2's `PermitSingle` + `PermitDetails` they do
not, the digests diverge, and signing breaks.

So the frontend does not use `viem/experimental/erc7739`. It reimplements the OZ encoding
in [`lib/erc7739.ts`](../lib/erc7739.ts), and the two halves are pinned against each other
by a cross-language vector.

### The vector

[`contracts/test/ERC7739Vector.t.sol`](../contracts/test/ERC7739Vector.t.sol) takes digests
produced by the TypeScript implementation, freezes them as constants, and asserts that
OpenZeppelin's `ERC7739Utils` computes the same values on-chain for identical inputs. Two
vectors run, differing only in the wallet's domain name, so a change to the *encoding*
breaks both while a plain domain rename breaks only one.

Alongside it, [`ERC7739IsValidSig.t.sol`](../contracts/test/ERC7739IsValidSig.t.sol)
deploys a real `BVCCSmartWalletV4` and `BVCCAgentWalletV4`, builds a genuine WebAuthn P-256
signature, and checks that `isValidSignature` accepts a Permit2 `PermitSingle` on both.

If either half drifts, a test fails instead of a user's swap.

**Regenerating the vector after a domain change:** run `lib/erc7739.ts`'s
`erc7739TypedDataDigest` with the new `verifierDomain.name` and the inputs in
`_permitSingleDigest`, then update the constant. The file header carries the recipe.

## Languages

Summaries and warnings are translated, not just the surrounding interface. Strings live in
[`lib/i18n/ns/wcdecode.ts`](../lib/i18n/ns/wcdecode.ts) (English and Spanish).
`wcCalls.ts` is a plain module with no React context, so `classifyCall(call, known, t)`
takes the translator as an argument.

## What this is not

It is a reading aid, not a guarantee. It does not simulate the transaction, so it cannot
tell you the price you will actually get or whether a contract will behave. A 🟢 means the
call was recognized and its addresses are familiar — nothing more. Read the summary, and if
it does not match what you thought you were doing, reject it.

## See also

- [Agent Integration](./agent-integration.md) · [Connect an AI](./connect-ai.md) · [Contract Reference](./contracts.md)
