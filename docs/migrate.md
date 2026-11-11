# Move to wallet V5

V5 is the current wallet generation. A wallet cannot be upgraded in place, because its address comes from your passkey and the factory that created it. Instead you create a V5 wallet with the same passkey and move your funds to it. Your old wallet keeps working and nothing moves on its own.

> Browsable on the web at [bvccwallet.blockventurechaincapital.com/docs/migrate](https://bvccwallet.blockventurechaincapital.com/docs/migrate).

## Before you start

- Passkey: you need the passkey that controls your current wallet, on this site. If the wallet was recovered through guardians, that is the passkey created during the recovery.
- Gas: a browser wallet such as MetaMask, with a little gas on the network, pays for the deploy and for a small transfer that lets the new wallet pay for its first signature.
- Guardians: the app copies them from your current wallet. If it has none, you are asked to enter three.
- Address: your V5 address is the same on every network. "What changes" on the V4 banner shows it before you deploy anything.

## Step 1 — Create the V5 wallet

- Open your current wallet on the network where you want to start. A banner at the top says which version you are on.
- Click "Create V5 wallet", on the banner or in the "What changes" window.
- Check the guardians and click "Confirm with passkey". The app checks that this passkey controls your current wallet. If it does not, it says so and nothing is deployed.
- Click "Deploy wallet" and confirm in your browser wallet. A second confirmation sends the small transfer to the new wallet, and then your passkey signs the guardian registration.
- When it finishes, the app opens your new V5 wallet.

> The passkey is checked before any gas is spent: a wallet you could not sign for is never deployed.

## Step 2 — Move your funds

- Go back to your old wallet: on the access screen paste its address and click "Enter". Your passkey still controls it.
- Close what you have open there first: Uniswap liquidity positions and Aave loans and deposits. They belong to the old address and do not move with the tokens.
- Click "Send everything" on the banner at the top. It sends what the old wallet holds on the network you are on, so do it on each network. Paste your V5 address, tick the tokens to move and click "Review". The app checks the operation before asking for anything: a token that would make it fail is unticked and marked.
- Check the address and click "Send with passkey". Every ticked token goes in one operation that you sign once. The usual fee is charged on each token: 0.05% on a personal wallet, 0.15% on an agent wallet.
- The native coin (ETH, BNB, POL) goes last and keeps back what the operation may cost in gas, so a few cents stay in the old wallet.
- Open your positions again from the V5 wallet if you want them.

## Step 3 — Other networks

- Each network has its own wallet. Switch network in the app, open your V5 wallet there and click "Deploy on this network". It uses the same address, passkey and guardians.
- Then repeat step 2 on that network, with "Send everything" from the old wallet there.

## Step 4 — Agents

- Agent permissions stay on the old wallet. Authorize your agents again on the V5 wallet, choosing what each one can do.
- Change the wallet address in the agent's configuration (WALLET_ADDRESS for the MCP server, walletAddress in the SDK) to your V5 address.
- Revoke the agents on the old wallet once they work on the new one, so an old key cannot move what is left there.

## What stays the same

- Your passkey: the same one signs both wallets. Do not delete it while the old wallet holds anything.
- Your guardians, unless you change them on the confirm screen.
- Your old wallet and its history. It is not closed or emptied for you.
