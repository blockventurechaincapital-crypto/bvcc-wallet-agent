# Recover your wallet

A BVCC wallet is controlled by a single passkey. If you lose it, or want to move the wallet to a new passkey, two of your three guardians can make a new passkey the owner. The wallet keeps its address, funds, positions and history. Recovery takes 48 hours and is done on each network separately.

> Browsable on the web at [bvccwallet.blockventurechaincapital.com/docs/recovery](https://bvccwallet.blockventurechaincapital.com/docs/recovery).

## Who does what

| Step | Who | What |
|---|---|---|
| 1 | Owner | Generates the new passkey and shares its X and Y coordinates |
| 2 | Guardian A | Starts the recovery with those coordinates |
| 3 | Guardian B | Checks the coordinates with the owner and approves |
| 4 | Nobody | 48-hour timelock — the current owner can still cancel |
| 5 | Any guardian | Executes the recovery |
| 6 | Owner | Enters with the new passkey, resumes agents, saves the guardians again |

## Before you start

- Guardians: you need two of the three guardian addresses registered on the wallet, each in a browser wallet such as MetaMask, with a little gas on the network. If Settings says "Recovery is not set up", the wallet has no guardians and cannot be recovered.
- Networks: a wallet deployed on several networks has a separate owner on each one. Recover it on every network where it exists, using the same new passkey on all of them.
- Device: generate the new passkey on the device you will use from now on, on the site where you use the wallet (bvccwallet.blockventurechaincapital.com, or your own domain if you self-host). A passkey only works on the site where it was created.
- Passkeys created before version 1.1.6 belonged to the whole blockventurechaincapital.com domain. The app no longer asks for them, because any site under that domain could. A wallet still controlled by one of them is moved to a new passkey with this same recovery.

## Step 1 — Generate the new passkey (owner)

- Open the recovery page: "Recover wallet" on the access screen, or Settings → "Manage recovery".
- Choose the network in the selector, paste the wallet address and click "Load". The guardians and "No active recovery" appear.
- In "I'm the owner — generate new key", click "Generate new passkey" and confirm it on your device.
- Copy "Coordinate X" and "Coordinate Y" and keep them until the recovery is finished on every network. They are only shown on this page: if you close it, you have to generate another passkey.

> ⚠️ The coordinates are a public key, not a secret — but the recovery installs exactly the key the guardian pastes. Send them over a channel you trust, and keep track of which passkey you shared: delete any extra one you generated only after you know it is not the one being installed.

## Step 2 — Start the recovery (first guardian)

- Open the recovery page, choose the same network, paste the wallet address and click "Load".
- In "I'm a guardian — sign recovery", click "Connect MetaMask" with the guardian account. If asked, switch the wallet to that network.
- Paste "New key X" and "New key Y", click "Initiate recovery" and confirm the transaction. This is the first of the two signatures.

The page refuses coordinates that are not a valid P-256 public key. Do not skip that check by starting the recovery elsewhere: a recovery approved with a broken key can never be executed, restarted or cancelled without the passkey you are replacing.

## Step 3 — Approve (second guardian)

- Open the recovery page with the same network and address, and connect with a different guardian account.
- Compare "Key this recovery would install" with the coordinates the owner generated, over another channel — a call, or in person. Tick "I checked these coordinates with the owner through another channel" and click "Approve recovery".
- With two signatures, the 48-hour timelock starts.

approveRecovery takes no parameters, so a guardian can also call it from the block explorer, under the Write Contract tab, when the explorer shows the wallet's code as verified. Never use initiateRecovery there — while a recovery is in progress it starts over with whatever key is typed in, and the explorer does not check the key.

## Step 4 — Wait 48 hours

- The wallet shows "Recovery in progress" with the signatures and the time left. Until the recovery is executed, the current passkey is still the owner and signs as usual.
- If you did not ask for this recovery, click "Cancel recovery" there or in Settings. Only the current owner can, and this window exists for exactly that.
- If you did ask for it, do not cancel: cancelling clears both approvals and the process starts again.
- The countdown uses your device clock, while the contract uses the network's time. If your clock is wrong, the countdown is wrong by the same amount.

## Step 5 — Execute (any guardian)

- When the timelock has expired, any guardian opens the recovery page with the same network and address, connects, and clicks "Execute recovery".
- From that moment the new passkey owns the wallet on that network, and the old one no longer signs there.

executeRecovery also takes no parameters and can be called from the explorer's Write Contract tab.

## Step 6 — Back into the wallet (owner)

- If you are still on the page where the recovery was executed, with the passkey generated there, click "Save new passkey and access →". Otherwise, on the access screen, enter the wallet address and click "Confirm with passkey", choosing the new passkey. The app checks it against the wallet before remembering it.
- Agent wallets: a recovery pauses every agent, so an agent authorized by whoever had your old passkey cannot keep spending. Review them in Agents and click "▶ Resume" once you are happy with the list.
- V4 wallets: in Settings → "Change guardians", save the same three guardians again. Signed with the new passkey, it records that passkey on-chain, so the app can find it when you enter by address from another browser.
- Repeat steps 2 to 6 on every other network where the wallet exists.

## After recovering on every network

- Delete the old passkey from your devices once no network is controlled by it any more.
- The wallet cannot be deployed at the same address on a new network: the address comes from the key it was created with, and deploying it with that key would hand the new copy to the old passkey. The app warns about this instead of offering the deployment.
