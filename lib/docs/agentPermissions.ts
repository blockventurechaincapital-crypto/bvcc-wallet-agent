// How an agent's permissions work on wallet V5 (current), with a short section for older
// V4 wallets. Surfaced from the agent authorize form.
import type { LocalizedDoc } from '@/components/DocsPage'

export const agentPermissions: LocalizedDoc = {
  en: {
    title: 'How agent permissions work',
    intro:
      'A BVCC Agent Wallet gives an AI agent a narrow set of powers that the contract enforces on-chain. You do not hand it your keys. You authorize an agent address to do specific things, within limits the wallet checks on every transaction. This page explains what those settings mean on wallet V5, the current generation, so you know exactly what you grant. Older V4 wallets work differently; see the last section.',
    blocks: [
      { type: 'h2', text: 'Capabilities instead of addresses' },
      {
        type: 'p',
        text: 'The authorize form starts with a simple question: what should this agent be able to do? Pick capabilities (swap on Uniswap, lend on Aave, provide liquidity, wrap ETH) and the form fills in the contracts, tokens and permissions each one needs. You do not need to know that the Universal Router uses Permit2, or which function of the Aave Pool a loan goes through; the picker composes it for you.',
      },
      {
        type: 'p',
        text: 'Everything the picker adds is shown, and every address links to the explorer’s Contract tab so you can check it is the real Uniswap, Aave or Permit2 contract.',
      },

      { type: 'h2', text: 'The wallet measures what leaves' },
      {
        type: 'p',
        text: 'This is the main change in V5. Before and after every agent operation, the wallet reads the balance of each token involved. Whatever left the wallet is charged against that agent’s limits, plus the 0.15% agent fee. It does not matter how the agent combines its calls, which protocol it goes through, or which approvals you gave in the past: if a token left, it counts.',
      },
      {
        type: 'list',
        items: [
          'A token that is not on the agent’s list and goes down makes the whole operation fail.',
          'Borrowing on Aave counts against the budget of the borrowed token, and withdrawing from Aave or from a liquidity position counts too, as the money comes in.',
          'Any approval the agent makes during an operation is set back to what it was before when the operation ends, so an agent never leaves an allowance behind.',
          'A swap into a token worth nothing is still charged at the full value that left. The worst a misbehaving agent can do is spend its own budget.',
        ],
      },

      { type: 'h2', text: 'What each kind of action needs' },
      {
        type: 'table',
        headers: ['Action', 'What allows it'],
        rows: [
          ['Sending native ETH (or BNB, POL)', 'An allowed destination + the native limits'],
          ['transfer(token)', 'An allowed token + an allowed destination + that token’s limits'],
          ['approve(spender)', 'An allowed token, and the spender must be an allowed protocol'],
          ['DeFi calls (swaps, Aave, liquidity, wrap)', 'An allowed protocol + a policy for that function + a yes from the protocol’s on-chain validator'],
        ],
      },
      {
        type: 'p',
        text: 'Every DeFi call goes through a validator: a small contract, one per protocol and network, that reads the call and checks that everything comes back to your wallet and which tokens move. The capabilities rely on them: swaps between tokens on Uniswap (Universal Router), Uniswap v4 liquidity, Aave v3, Uniswap v3 liquidity and wrapping ETH (ETH ↔ WETH). All are active on every supported network. To swap to or from native ETH, combine a swap with wrapping. SwapRouter02 is not offered to agents.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Adding a new validator takes 48 hours, announced on-chain before it takes effect. Switching one off is immediate.',
      },

      { type: 'h2', text: 'Limits and destinations: what 0 and empty mean' },
      {
        type: 'list',
        items: [
          'Empty means nothing. A limit left empty or at 0 allows nothing. To let the agent move ETH, fill in its three ETH limits; for each token, its three token limits. There is no "unlimited" in the form: set a number.',
          'Limits include the 0.15% agent fee. With a max per operation of 0.02 ETH, the agent can send up to about 0.01997 ETH. In a batch, the max per operation applies to the whole batch added up.',
          'Destinations: an empty list means the agent cannot send to anyone. There is no "any destination" option.',
          'The expiry is required and can be at most one year away. You can renew it.',
          'The Uniswap permissions (Permit2) are granted by you, in the same passkey signature that authorizes the agent, and last until the agent expires. The agent cannot grant them itself. Renewing the agent renews them.',
        ],
      },

      { type: 'h2', text: 'Controls on each agent' },
      {
        type: 'list',
        items: [
          'Pause / Resume: stops that agent only. Its limits and history stay as they are.',
          'Renew: moves the expiry, and the Uniswap permissions with it.',
          'Block a contract: no agent can call it, whatever its permissions say. Your own operations are not affected.',
          'Pause all agents: the general switch.',
          'Revoke: removes the agent. Its spending history is kept if you authorize it again.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'During a guardian recovery the agents keep working; they are paused when the recovery is executed. Their limits bound what they can do in the meantime.',
      },

      { type: 'h2', text: 'What you still decide' },
      {
        type: 'list',
        items: [
          'Which tokens an agent may use. The wallet trusts the token contracts on that list, so stick to well-known tokens.',
          'Approvals you give yourself from other apps. An agent cannot use them beyond its budget, but revoke the ones you no longer need.',
          'The agent key must belong to a plain address (an EOA). If that address gets a smart-account delegation (EIP-7702), the agent stops working.',
        ],
      },

      { type: 'h2', text: 'Verifying a contract' },
      {
        type: 'p',
        text: 'Click any address in the form or on an agent’s card. It opens the block explorer on the Contract tab, where you can confirm the address is the canonical, verified contract for that protocol before you authorize anything.',
      },

      { type: 'h2', text: 'Older wallets (V4)' },
      {
        type: 'p',
        text: 'V4 wallets keep working, but their agent model is the previous one. The main differences:',
      },
      {
        type: 'list',
        items: [
          'A limit of 0 means unlimited, and an empty destinations list means any destination.',
          'DeFi calls are allowed by per-function policies that pin the destination to your wallet, with a validator only for the Universal Router and Uniswap v4 liquidity. Approvals go to allowed destinations.',
          'The wallet does not measure what leaves. Where you have already approved a protocol from another app, an agent can spend through that approval beyond its token budget. Before authorizing an agent on a V4 wallet, revoke standing approvals to the protocols it can reach.',
          'Expiry is optional and pausing applies to all agents at once.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'If you still use a V4 wallet with agents, consider moving to V5. See Move to wallet V5.',
      },
    ],
  },
  es: {
    title: 'Cómo funcionan los permisos del agente',
    intro:
      'Una BVCC Agent Wallet le da a un agente IA un conjunto reducido de poderes que el contrato aplica en cadena. No le entregas tus claves. Autorizas una dirección de agente a hacer cosas concretas, dentro de límites que la wallet comprueba en cada transacción. Esta página explica qué significan esos ajustes en la wallet V5, la generación actual, para que sepas exactamente qué concedes. Las wallets V4, más antiguas, funcionan de otra forma; ver el último apartado.',
    blocks: [
      { type: 'h2', text: 'Capacidades en vez de direcciones' },
      {
        type: 'p',
        text: 'El formulario empieza con una pregunta simple: ¿qué quieres que pueda hacer este agente? Eliges capacidades (intercambiar en Uniswap, prestar en Aave, dar liquidez, envolver ETH) y el formulario rellena los contratos, tokens y permisos que necesita cada una. No necesitas saber que el Universal Router usa Permit2, ni por qué función del Pool de Aave pasa un préstamo; el selector lo compone por ti.',
      },
      {
        type: 'p',
        text: 'Todo lo que añade el selector se muestra, y cada dirección enlaza a la pestaña Contract del explorador para que compruebes que es el contrato real de Uniswap, Aave o Permit2.',
      },

      { type: 'h2', text: 'La wallet mide lo que sale' },
      {
        type: 'p',
        text: 'Es el cambio principal de la V5. Antes y después de cada operación de un agente, la wallet lee el saldo de cada token implicado. Lo que haya salido de la wallet se carga a los límites de ese agente, más la comisión de agente del 0,15 %. Da igual cómo combine el agente sus llamadas, por qué protocolo pase o qué aprobaciones dieras en el pasado: si un token salió, cuenta.',
      },
      {
        type: 'list',
        items: [
          'Si baja un token que no está en la lista del agente, toda la operación falla.',
          'Pedir prestado en Aave cuenta contra el presupuesto del token prestado, y retirar de Aave o de una posición de liquidez también cuenta, al entrar el dinero.',
          'Cualquier aprobación que haga el agente durante una operación vuelve a lo que era antes al terminar, así que un agente nunca deja una allowance viva.',
          'Un intercambio hacia un token sin valor se cobra igualmente por todo el valor que salió. Lo peor que puede hacer un agente que se porte mal es gastar su propio presupuesto.',
        ],
      },

      { type: 'h2', text: 'Qué necesita cada tipo de acción' },
      {
        type: 'table',
        headers: ['Acción', 'Qué la permite'],
        rows: [
          ['Enviar ETH nativo (o BNB, POL)', 'Un destino permitido + los límites nativos'],
          ['transfer(token)', 'Un token permitido + un destino permitido + los límites de ese token'],
          ['approve(spender)', 'Un token permitido, y el spender debe ser un protocolo permitido'],
          ['Llamadas DeFi (intercambios, Aave, liquidez, envolver)', 'Un protocolo permitido + una policy para esa función + un sí del validador en cadena del protocolo'],
        ],
      },
      {
        type: 'p',
        text: 'Toda llamada DeFi pasa por un validador: un contrato pequeño, uno por protocolo y red, que lee la llamada y comprueba que todo vuelve a tu wallet y qué tokens se mueven. Las capacidades se apoyan en ellos: intercambios entre tokens en Uniswap (Universal Router), liquidez en Uniswap v4, Aave v3, liquidez en Uniswap v3 y envolver ETH (ETH ↔ WETH). Todos están activos en todas las redes soportadas. Para intercambiar desde o hacia ETH nativo, combina un intercambio con envolver. No se ofrece SwapRouter02 a los agentes.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Añadir un validador nuevo lleva 48 horas, anunciado en cadena antes de tener efecto. Desactivar uno es inmediato.',
      },

      { type: 'h2', text: 'Límites y destinos: qué significan 0 y vacío' },
      {
        type: 'list',
        items: [
          'Vacío significa nada. Un límite vacío o a 0 no permite nada. Para que el agente mueva ETH, rellena sus tres límites de ETH; para cada token, sus tres límites. En el formulario no hay «sin límite»: pon un número.',
          'Los límites incluyen la comisión del 0,15 % del agente. Con un máximo por operación de 0,02 ETH, el agente puede enviar como mucho unos 0,01997 ETH. En un lote, el máximo por operación cuenta la suma de todo el lote.',
          'Destinos: una lista vacía significa que el agente no puede enviar a nadie. No existe la opción «cualquier destino».',
          'La caducidad es obligatoria y como mucho a un año vista. Se puede renovar.',
          'Los permisos de Uniswap (Permit2) los das tú, en la misma firma con passkey que autoriza al agente, y duran hasta que el agente caduca. El agente no puede dárselos él solo. Al renovar el agente se renuevan.',
        ],
      },

      { type: 'h2', text: 'Controles de cada agente' },
      {
        type: 'list',
        items: [
          'Pausar / Reanudar: para solo ese agente. Sus límites y su historial se mantienen.',
          'Renovar: cambia la caducidad, y con ella los permisos de Uniswap.',
          'Bloquear un contrato: ningún agente podrá llamarlo, digan lo que digan sus permisos. Tus propias operaciones no se ven afectadas.',
          'Pausar todos los agentes: el interruptor general.',
          'Revocar: quita al agente. Si lo vuelves a autorizar, conserva su historial de gasto.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Durante una recuperación con guardianes los agentes siguen funcionando; se pausan cuando la recuperación se ejecuta. Mientras tanto, sus límites acotan lo que pueden hacer.',
      },

      { type: 'h2', text: 'Lo que sigues decidiendo tú' },
      {
        type: 'list',
        items: [
          'Qué tokens puede usar un agente. La wallet se fía de los contratos de los tokens de esa lista, así que quédate con tokens conocidos.',
          'Las aprobaciones que das tú desde otras apps. Un agente no puede usarlas por encima de su presupuesto, pero revoca las que ya no necesites.',
          'La clave del agente debe ser de una dirección normal (una EOA). Si esa dirección recibe una delegación de smart account (EIP-7702), el agente deja de funcionar.',
        ],
      },

      { type: 'h2', text: 'Verificar un contrato' },
      {
        type: 'p',
        text: 'Pulsa cualquier dirección del formulario o de la tarjeta de un agente. Abre el explorador en la pestaña Contract, donde puedes confirmar que la dirección es el contrato canónico y verificado de ese protocolo antes de autorizar nada.',
      },

      { type: 'h2', text: 'Wallets antiguas (V4)' },
      {
        type: 'p',
        text: 'Las wallets V4 siguen funcionando, pero su modelo de agentes es el anterior. Las diferencias principales:',
      },
      {
        type: 'list',
        items: [
          'Un límite de 0 significa ilimitado, y una lista de destinos vacía significa cualquier destino.',
          'Las llamadas DeFi se permiten con policies por función que anclan el destino a tu wallet, con validador solo para el Universal Router y la liquidez de Uniswap v4. Las aprobaciones van a destinos permitidos.',
          'La wallet no mide lo que sale. Si ya aprobaste un protocolo desde otra app, un agente puede gastar con esa aprobación por encima de su presupuesto de token. Antes de autorizar un agente en una wallet V4, revoca las aprobaciones vivas a los protocolos que pueda alcanzar.',
          'La caducidad es opcional y la pausa se aplica a todos los agentes a la vez.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Si aún usas una wallet V4 con agentes, plantéate pasar a la V5. Ver Pasar a la wallet V5.',
      },
    ],
  },
}
