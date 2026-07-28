# BVCC Agent Wallet V4 — Estado

> **V4 DESPLEGADO EN LAS 6 REDES (28 jul 2026).** Verificado on-chain: bytecode idéntico
> (smart 15.959 B, agent 24.541 B), owner `0x3145Bd5e…A4c`, registry intacto en todas.
>
> | Contrato | Salt | Dirección (igual en las 6 redes) |
> |---|---|---|
> | BVCCSmartWalletFactoryV4 | `…0A` | `0xfd105197109244483b5f870501326E6faec9F93c` |
> | BVCCAgentWalletFactoryV4 | `…0B` | `0xf3A61F9d64d45362E149A111289546523BCd26a6` |
> | BVCCValidatorRegistry | `…06` | `0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2` — **sin cambios** |
>
> Redes: Arbitrum One · Ethereum · BNB Chain · Base · Polygon · Arbitrum Sepolia.
> Contratos renombrados a V4, dominio EIP-712 `BVCCSmartWalletV4`. `forge test` 303/303.
> Los validators se comparten entre generaciones → **no hay que re-registrar nada**.
>
> **Los 7 arreglos de V4:** reentrada cruzada (2 capas) · apropiación de guardianes ·
> `credentialId` autenticado · `setCredentialId` (rotación) · `approve` sin ETH ·
> el recovery pausa agentes · guardianes rotables. Detalle en
> `agente_testing/AGENT_TESTING_REPORT.md` §11-§14 y en los informes de `audits/`.
>
> **PENDIENTE:** migrar usuarios de V3 → V4, y solo después `kill()` de las factories V3
> (`0xD42F61AA…` / `0xd866a756…`). Frontend ya adaptado y apuntando a V4.
>
> Lo que sigue debajo es el estado de **V3**, que se mantiene como historia.

---

# BVCC Agent Wallet V3 — Estado

> Documento de estado interno. Fecha: **17 jul 2026**. Alcance validado: **solo Arbitrum One**. Cambios de frontend: **solo local, sin subir a VPS ni GitHub**.

---

## 1. Qué es V3 y por qué

V3 es un **fix de seguridad** sobre V2. En V2 una clave de agente robada podía **exfiltrar fondos sin consumir presupuesto**:

- `Pool.withdraw(asset, amount, to)` de Aave no requiere `approve` ni `transfer` → mueve la posición suplida directamente a `to`. El budget del agente (que se descuenta vía `approve`) **no se enteraba**. Primera vía de robo no capada.
- Lo mismo con swaps/LP donde el `recipient` es un argumento: el atacante ponía su propia dirección como destino.

**Solución V3:** *call policies* por selector con **anclaje del destinatario a la propia wallet**. El Caso 3 (llamadas DeFi de agente) pasa a **default-deny por selector**; whitelistar el protocolo ya **no** basta, hay que registrar una policy que fija a qué dirección puede ir el dinero.

Regla de oro: **el firmante biométrico (dueño) NO está limitado por las policies** — usa cualquier plataforma con normalidad por Face ID. Las policies **solo** aplican a los agentes.

---

## 2. Mecanismo de call policies

Mapping en `BVCCAgentWalletV3`:

```solidity
mapping(address target => mapping(bytes4 selector => uint256 policy)) internal _callPolicies;
```

Se fija con `setCallPolicy(target, selector, policy)` (solo la wallet, vía Face ID) y se lee con `getCallPolicy(target, selector)`.

### Layout de la palabra `policy` (uint256)

| Bits | Campo | Significado |
|------|-------|-------------|
| 255 | `POLICY_ALLOWED` | El selector está permitido. Sin este bit → `SelectorNotAllowed` |
| 254 | `POLICY_DEEP` | Validación profunda vía el registry (para calldata de longitud variable) |
| 223..192 | `PIN_WALLET` (bitmap 32b) | La palabra `i` del calldata **debe ser** `address(this)` |
| 191..160 | `PIN_PROTOCOL` (bitmap 32b) | La palabra `i` **debe estar** en `allowedProtocols` |
| 159..0 | — | Sin uso (el validator ya no viaja en la policy; ver §3) |

### `_checkCallPolicy` (resumen)

1. Extrae el selector del calldata (`data.length >= 4`, si no `CalldataTooShort`).
2. `policy = _callPolicies[target][selector]`; exige `POLICY_ALLOWED` (si no `SelectorNotAllowed`).
3. Recorre los bitmaps `PIN_WALLET` / `PIN_PROTOCOL`: cada palabra marcada se compara a la wallet o se comprueba que sea un protocolo permitido (si no `PinnedArgMismatch`). Compara palabra completa → rechaza high-bits sucios.
4. Si `POLICY_DEEP`: `staticcall` a `VALIDATOR_REGISTRY.validate(...)`, exige `true` (si no / revert / sin código → `PolicyValidationFailed`, **fail-closed**).

### Presets actuales (Arbitrum) — `bvcc_wallet/lib/callPolicies.ts`

| Protocolo | Selector | Tipo | Policy |
|-----------|----------|------|--------|
| SwapRouter02 `0x68b3…Fc45` | `exactInputSingle` | PIN_WALLET word 3 | `0x8000…0008…` |
| Aave v3 Pool `0x794a…14ad` | `supply` / `withdraw` / `borrow` / `repay` | PIN_WALLET word 2 / 2 / 4 / 3 | pin |
| Universal Router `0x8B84…1E6b` | `execute(bytes,bytes[],uint256)` = `0x3593564c` | **DEEP** | `0xC000…0000` |

---

## 3. Registry de validators

`BVCCValidatorRegistry` — punto de despacho de dirección **fija**, compilado como constante `VALIDATOR_REGISTRY` dentro de la wallet. Como la policy solo lleva un **flag** DEEP (no una dirección), a un dueño **no se le puede colar un validator falso** (anti-phishing).

- **Fail-closed:** sin validator registrado para un target → `validate()` devuelve `false` → el agente revierte.
- **Gobernanza asimétrica:**
  - *Denegar* (`freezeValidator`, `cancelProposal`) → **inmediato**.
  - *Permitir* (`proposeValidator` → `activateValidator`) → **timelock de 48h** + evento `ValidatorProposed`, para que los dueños reaccionen (pausar agentes / revocar) ante una propuesta maliciosa.
- **Doble consentimiento** para habilitar un protocolo complejo: (1) BVCC registra el validator en el registry, (2) el frontend añade el preset con `ALLOWED|DEEP`. Falta cualquiera → no funciona.
- Los validators son **contratos view/stateless**: nunca mueven fondos, solo responden yes/no. Peor caso con la admin key robada = DoS o degradar al nivel de V2 tras 48h públicos.

`IBVCCValidator.validate(address wallet, address target, uint256 value, bytes calldata data) view returns (bool)`.

### `BVCCUniversalRouterValidator`

Necesario porque en el Universal Router el `recipient` va **enterrado dentro de `inputs` de longitud variable** — un pin de bitmap fijo no lo alcanza.

- **Ligado a UNA dirección de router** (constructor `UNIVERSAL_ROUTER` immutable; `target != UR → false`). Un router nuevo necesita su propio validator.
- Decodifica `execute(bytes commands, bytes[] inputs, uint256 deadline)`; malformado → revert → deny.
- **Coincidencia EXACTA de byte de comando** (sin máscara): `{V3_SWAP_EXACT_IN 0x00, V3_SWAP_EXACT_OUT 0x01, V4_SWAP 0x10}`. Cualquier otro byte (aliases, allow-revert `0x80`, comandos ≥0x40) → deny.
- Todo `recipient` (incl. `TAKE` de v4, actions `{0x07 SWAP, 0x0b SETTLE, 0x0e TAKE}`) debe ser la wallet o `MSG_SENDER (0x01)`.
- Rechaza `commands.length == 0`.
- **MVP token→token**: native / `ADDRESS_THIS` fuera de alcance (ver §9).

> **Bug crítico corregido (catch del usuario):** la 1ª versión enmascaraba `& 0x3f`; el router real usa `& 0x7f` (`FLAG_ALLOW_REVERT=0x80`). El comando `0x40` (`ACROSS_V4_DEPOSIT_V3`) **no** es alias de `0x00` — con la máscara mala el validator lo habría aceptado como swap v3 mientras el router bridgeaba fondos cross-chain al atacante. Verificado empíricamente con `cast`. Fix = coincidencia exacta + binding a router + rechazo de vacíos.

---

## 4. Contratos

Renombrados V2→V3 (nombres de archivo sin cambiar). EIP712 domain = **"BVCCSmartWalletV3"**.

| Archivo | Contrato | `walletType()` |
|---------|----------|----------------|
| `src/BVCCWallet.sol` | `BVCCSmartWalletV3` | 0 |
| `src/BVCCAgentWallet.sol` | `BVCCAgentWalletV3` | 1 |
| `src/BVCCWalletFactory.sol` | `BVCCSmartWalletFactoryV3` | — |
| `src/BVCCAgentWalletFactory.sol` | `BVCCAgentWalletFactoryV3` | — |
| `src/BVCCValidatorRegistry.sol` | `BVCCValidatorRegistry` | — |
| `src/BVCCUniversalRouterValidator.sol` | `BVCCUniversalRouterValidator` | — |
| `src/IBVCCValidator.sol` | `IBVCCValidator` (interfaz view) | — |

Custom errors nuevos: `SelectorNotAllowed`, `PinnedArgMismatch`, `CalldataTooShort`, `PolicyValidationFailed` (+ `NotGuardian`, `InvalidGuardian`, `InsufficientBalanceForFee` por bytecode).

**Build congelado** (crítico para las CREATE2): `solc = "0.8.36"`, `optimizer_runs = 50`, `via_ir = true`, `evm_version = "cancun"`. Razón: evitar el rango 0.8.28–0.8.33 con el bug del pipeline via-IR. Factory de agente = **24.283 bytes** runtime (margen 293 sobre el límite de 24.576). *Hay que pinnear la versión exacta de solc o las direcciones CREATE2 derivan.*

---

## 5. Direcciones — Arbitrum One (chainId 42161)

| Contrato | Dirección | Verificado en Arbiscan |
|----------|-----------|------------------------|
| BVCCValidatorRegistry | `0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2` | ✅ Sí |
| BVCCSmartWalletFactoryV3 | `0xD42F61AA856A4f47885Ecd2D0ce119411d53C192` | ❌ No (a propósito) |
| BVCCAgentWalletFactoryV3 | `0xd866a7563cDaC9F71423be3332b62c329C676064` | ❌ No (a propósito) |
| BVCCUniversalRouterValidator | `0xa2cDCdEd08F621d777c33ED212F8DEf564aEa92E` | ✅ Sí |
| EntryPoint (OZ v0.9) | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` | (externo) |

**Roles**

| Rol | Dirección |
|-----|-----------|
| Admin (owner registry + factories + kill-switch) | `0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c` (Ledger) |
| Deployer (sin privilegios) | `0xA3e06B…6617D` |
| Fee wallet | `0x3e3eb089169a7315a994947465ce5f5FC3A307D4` |

**Salts CREATE2:** registry `…06`, smartFactory `…07`, agentFactory `…08`, UR validator `…09`.
**Codehashes** (`deployments/ur-validator.42161.json`): validator `0x323ddcc6…925fac3`, router Arbitrum `0x044f2b70…86569ee`.

> Verificación: el **registry y el validator sí** están verificados (son públicos/transparentes por diseño; verificar no da ventaja al atacante — el bytecode ya es público y `validate()` es view fuzzeable). **Factory y wallet a propósito sin verificar** hasta validar todo.

---

## 6. Tests

- **Foundry: 222 pass / 0 fail.** SDK vitest: 32 pass.
- `test/CallPolicyAdversarial.t.sol` (34): withdraw/supply/borrow/repay con `to`/`onBehalfOf` externo → `PinnedArgMismatch`; selector no registrado → `SelectorNotAllowed`; `PIN_PROTOCOL` rechaza spender no autorizado; DEEP con validator false/revert/baddata/codeless/sin-registrar → deny y con true → pasa; timelock 48h + freeze + cancel + onlyOwner; `policy=0` revoca; calldata corto / pin fuera de rango / high-bits sucios; batch con 1 item malo revierte todo.
- `test/UniversalRouterValidator.t.sol` (39): corpus SDK v3/v4, recipient=atacante, SWEEP/TRANSFER/PAY_PORTION/WRAP/UNWRAP denegados, bytes `0x40/0x41/0x7f/0x80/0xc0`, target-mismatch, commands vacíos, **fuzz de los 256 bytes** (validator vs modelo del router), golden vectors del SDK embebidos.
- `test/AaveIntegration.t.sol` (10, fork real): ciclo supply→borrow→repay→withdraw; **fee 0.15% exacto** en withdraw/borrow, cero en supply/repay; adversariales; presupuesto vía approve.
- `test/Create2Consistency.t.sol`: freeze-guard (la constante `VALIDATOR_REGISTRY` == CREATE2 del registry).
- Gas: `createWallet` 4.548.977 · `authorizeAgent` 166.803 · `setCallPolicy` 25.912 · `executeAsAgent` (Caso 3) 64.758.

---

## 7. Frontend (local, solo Arbitrum, sin subir)

En `Desktop/bvcc_wallet/` — **NO** en `Desktop/github/`, **NO** en el VPS:

- `lib/networks.ts` → Arbitrum apunta a las factories V3.
- `lib/abis.ts` → `setCallPolicy` / `getCallPolicy` + errores V3.
- `lib/callPolicies.ts` → presets (SwapRouter02, Aave Pool, Universal Router DEEP); estructura `{label, defs}` + `presetProtocolSuggestions()`.
- `app/wallet/agents/page.tsx` → `sendUserOp` acepta batch (autorizar agente adjunta los `setCallPolicy` en la misma firma Face ID); sugiere UR + Aave + SwapRouter02.
- **erc7739**: *no requiere cambios* — `WcConnectModal.getVerifierDomain()` lee el dominio on-chain (`getEip712Domain()`), así que ya resuelve "BVCCSmartWalletV3". El path humano (Uniswap por WalletConnect) funciona en V3 sin tocar código.

---

## 8. Validación end-to-end (Arbitrum mainnet)

- Wallet V3 de prueba: `0x605A4C65dBa64bd26d9F7701e1e4Cda48c594A5c` (walletType 1). Agente: `0x38529C66F3cf22453D66B9E2A20FdF2676544aB4`.
- **Swap real** USDC→WETH 0.2 por el MCP (`@bvcc/agent-mcp`): tx `0x4768…a8ae`, status 1; USDC −0.2 exacto, WETH a la wallet, **fee 0.15% exacto** al fee wallet.
- **Adversarial on-chain** (cast call): mismo swap con `recipient = atacante` → revierte `0xaa53a959 = PinnedArgMismatch()` **antes de ejecutar**; con `recipient = wallet` → pasa la policy (falla solo por falta de approve en el batch mínimo). **Prueba definitiva en mainnet de que el pin corta el robo.**

---

## 9. Análisis de swaps con ETH nativo (documentado, sin implementar)

`bvcc-agent-sdk/NATIVE-SWAP-ANALYSIS.md`. Verificado en fork: `WETH.deposit{value}` es Caso 3 → cobra 0.15%; `WETH.withdraw` → sin fee.

- **Token→ETH funciona** con el contrato actual (`approve` + swap→WETH recipient=wallet + `WETH.withdraw`), fee única, atómico.
- **ETH→Token** con doble fee (~0.30%); native-in por UR exigiría `ADDRESS_THIS` (fuera de alcance por seguridad).
- Conclusión: native queda **fuera del UR validator**; se ofrecerá como tool futura del SDK. El dueño usa native por Face ID.

---

## 10. Estado del registro del UR validator

**✅ COMPLETADO (20 jul 2026).**

| Paso | Estado |
|------|--------|
| Validator desplegado + verificado en Arbiscan | ✅ |
| `proposeValidator(UR, 0xa2cD…a92E)` (Arbiscan + Ledger) | ✅ 17 jul |
| Timelock 48h | ✅ vencido 19 jul 08:02 UTC |
| `activateValidator(0x8B844f…1E6b)` | ✅ 20 jul — `validators(UR)` = `0xa2cD…a92E` |
| Preset UR DEEP + Permit2 en frontend | ✅ |
| **Swap real por UR + fee/recipient verificados** | ✅ 20 jul |

### Verificación del gate (antes / después de activar)

| `registry.validate(...)` | Antes | Después |
|---|---|---|
| swap legítimo (recipient = wallet) | false | **true** |
| swap robo (recipient = atacante) | false | **false** |
| cmd `0x40` (ACROSS bridge) | false | **false** |
| target ≠ UR | false | **false** |

El fix de la máscara queda confirmado en mainnet, no solo en tests.

### Swap real (tx `0x6f831b37…3bc0`)

Batch atómico de 3 llamadas, cada una atravesando una capa distinta:

| # | Target | Selector | Capa |
|---|--------|----------|------|
| 1 | USDC | `0x095ea7b3` approve | Caso 2b → `allowedRecipients` (Permit2) |
| 2 | Permit2 | `0x87517c45` approve | Caso 3 → `PIN_PROTOCOL` en spender (word 1) |
| 3 | Universal Router | `0x3593564c` execute | Caso 3 → **DEEP → validator** |

Resultado: `status 1`, gas 419.124. USDC −0.100000 exacto. Pool → wallet 0.000052312554080175 WETH; wallet → fee wallet 0.000000078468831120 WETH = **0.15% exacto**. Recipient siempre la wallet.

### Permit2 — por qué hace falta y por qué no debilita nada

El v4 del Universal Router cobra los fondos vía Permit2, no por allowance directa. Policy: `approve(address,address,uint160,uint48)` con **PIN_PROTOCOL en la palabra 1** (el spender), porque el spender es el router y no la wallet — anclarlo a la wallet rompería el flujo. No abre superficie nueva:

- Permit2 concede *"puede tirar"*, no *"puede enviar a donde quiera"* — el destino lo sigue decidiendo el validator en `execute`.
- PIN_PROTOCOL → el agente solo puede nombrar spender a un protocolo ya whitelisteado; nunca a un atacante (verificado: `PinnedArgMismatch`).
- La allowance solo la ejercita quien sea `msg.sender` = la wallet. Si un atacante llama al UR desde su EOA, el router tira de *su* allowance, no de la nuestra.

---

## 11. Próximas fases

- **(a) ✅ COMPLETADO 20 jul** — UR validator activo + swap real verificado (ver §10).
- **(b)** `BVCC1inchValidator` (+ Pendle…) siguiendo el patrón del UR validator (necesita validator registrado + preset DEEP coordinados). **Es el único pendiente que lleva timelock de 48h.**
- **(c)** Tools SDK/MCP para Universal Router y Aave → plan detallado en `bvcc-agent-sdk/SDK-TOOLS-PLAN.md`.

> **Aave NO necesita validator ni timelock.** Sus argumentos de destino (`onBehalfOf` / `to`) están en offsets fijos, así que se resuelven con pins de bitmap dentro del propio wallet — el registry ni se consulta (`validators(Pool)` = `0x0` y da igual, porque ninguna policy de Aave lleva el bit DEEP). Las 4 policies (`supply` w2, `withdraw` w2, `borrow` w4, `repay` w3) ya están escritas y verificadas on-chain, y probadas en fork (`AaveIntegration.t.sol`). Lo único que le falta a Aave son las tools del SDK. Solo necesitarían validator las operaciones cuya seguridad no se puede expresar como "la palabra N debe ser la wallet" (flash loans, multicall, adaptadores ParaSwap) — el hipotético `BVCCComplexAaveValidator`, fuera de alcance.
- **(d)** Propagar el deploy V3 a las otras 5 redes (Ethereum, Base, BNB, Polygon, Arb Sepolia) + `networks.ts`/`abis.ts`/`callPolicies.ts`.
- **(e)** Subir frontend a VPS/GitHub + verificar factory/wallet en Arbiscan (cuando el usuario dé el OK).

## 12. Qué cubre cada capa (y qué significan los defaults)

> Semántica **intencional y documentada**, no un defecto: `0 = ilimitado` en todos los límites y **lista vacía = cualquiera** en recipients. Igual que en V1/V2. Lo que V3 cambió fue el Caso 3, que pasó a default-deny; `allowedProtocols` vacío ya no significa "todos", revierte con `NoProtocolsWhitelisted`.

Las call policies solo gobiernan el **Caso 3** (DeFi). Los Casos 2 y 2b tienen otro guardián:

| Caso | Qué es | Quién lo gobierna |
|------|--------|-------------------|
| 1 | envío de ETH | `allowedRecipients` + límites nativos |
| 2 | `transfer(to, amount)` | `allowedRecipients` + límites de token |
| 2b | `approve(spender, amount)` | `allowedRecipients` + límites de token |
| 3 | DeFi / swap | `allowedProtocols` + **call policies** |

**La asimetría a tener presente:** el Caso 3 es seguro por construcción (default-deny), mientras que los Casos 1/2/2b dependen de lo que configure el dueño. Medido en mainnet sobre el agente de pruebas (simulación `cast call --from <agente>`, sin mover fondos):

| Simulación (clave de agente robada) | Recipients `[]`, límites `0` | Con recipients + límites |
|---|---|---|
| `USDC.transfer(atacante, ~todo)` | pasa | ❌ `RecipientNotAllowed` |
| `USDC.approve(atacante, mucho)` | pasa | ❌ `RecipientNotAllowed` |
| `USDC.transfer(destino OK, 2)` | — | ❌ `ExceedsTokenMaxAmount` |
| `Permit2.approve(spender=atacante)` | ❌ `PinnedArgMismatch` | ❌ `PinnedArgMismatch` |
| `UR.execute` recipient=atacante | ❌ `PolicyValidationFailed` | ❌ `PolicyValidationFailed` |

Las dos últimas filas no dependen de la config: el Caso 3 aguanta igual. Las dos primeras sí.

Sirve para no sobreleer el titular de V3: *"cierra el robo por swaps y retiradas de protocolo"* es cierto; *"un agente comprometido ya no puede sacar fondos"* no lo es — un `transfer` directo sigue gobernado por recipients y límites, que el dueño elige. Es coherente con el modelo: **los límites on-chain son el modelo de seguridad**, y se eligen.

**Configuración recomendada por agente:**
1. `allowedRecipients` con los destinos legítimos. Si se usa el Universal Router, **Permit2 debe estar en la lista** (el `approve` ERC-20 del flujo v4 es Caso 2b). El UR no hace falta: se le autoriza vía `Permit2.approve`, que es Caso 3.
2. Límites de token (`maxPerTx` / diario / total) como defensa en profundidad.

**Decisión de producto abierta (no es un bug):** si el formulario de agentes debería señalar qué implica guardar con recipients vacío y límites a 0, o proponer por defecto los protocolos elegidos como recipients. Hoy el default es el permisivo, deliberadamente.

## 13. Migración V2 → V3

El bytecode del wallet cambió → **las direcciones CREATE2 de V3 son distintas de V2**. Playbook igual que V1→V2: los usuarios recrean su wallet y mueven fondos; las factories V2 se `kill()` después. Las capacidades futuras (registrar validators, tools Aave, 1inch) son **bytecode-neutrales** → no obligan a una segunda migración.
