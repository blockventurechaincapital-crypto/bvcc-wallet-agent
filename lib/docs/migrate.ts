// Moving from an older wallet generation to V5: create the new wallet with the same passkey,
// then move funds, positions and agents. Button names match the wallet screens.
import type { LocalizedDoc } from '@/components/DocsPage'

export const migrate: LocalizedDoc = {
  en: {
    title: 'Move to wallet V5',
    intro:
      'V5 is the current wallet generation. A wallet cannot be upgraded in place, because its address comes from your passkey and the factory that created it. Instead you create a V5 wallet with the same passkey and move your funds to it. Your old wallet keeps working and nothing moves on its own.',
    blocks: [
      { type: 'h2', text: 'Before you start' },
      {
        type: 'list',
        items: [
          'Passkey: you need the passkey that controls your current wallet, on this site. If the wallet was recovered through guardians, that is the passkey created during the recovery.',
          'Gas: a browser wallet such as MetaMask, with a little gas on the network, pays for the deploy and for a small transfer that lets the new wallet pay for its first signature.',
          'Guardians: the app copies them from your current wallet. If it has none, you are asked to enter three.',
          'Address: your V5 address is the same on every network. "What changes" on the V4 banner shows it before you deploy anything.',
        ],
      },

      { type: 'h2', text: 'Step 1 — Create the V5 wallet' },
      {
        type: 'list',
        items: [
          'Open your current wallet on the network where you want to start. A banner at the top says which version you are on.',
          'Click "Create V5 wallet", on the banner or in the "What changes" window.',
          'Check the guardians and click "Confirm with passkey". The app checks that this passkey controls your current wallet. If it does not, it says so and nothing is deployed.',
          'Click "Deploy wallet" and confirm in your browser wallet. A second confirmation sends the small transfer to the new wallet, and then your passkey signs the guardian registration.',
          'When it finishes, the app opens your new V5 wallet.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'The passkey is checked before any gas is spent: a wallet you could not sign for is never deployed.',
      },

      { type: 'h2', text: 'Step 2 — Move your funds' },
      {
        type: 'list',
        items: [
          'Go back to your old wallet: on the access screen paste its address and click "Enter". Your passkey still controls it.',
          'Close what you have open there first: Uniswap liquidity positions and Aave loans and deposits. They belong to the old address and do not move with the tokens.',
          'Click "Send everything" on the banner at the top. It sends what the old wallet holds on the network you are on, so do it on each network. Paste your V5 address, tick the tokens to move and click "Review". The app checks the operation before asking for anything: a token that would make it fail is unticked and marked.',
          'Check the address and click "Send with passkey". Every ticked token goes in one operation that you sign once. The usual fee is charged on each token: 0.05% on a personal wallet, 0.15% on an agent wallet.',
          'The native coin (ETH, BNB, POL) goes last and keeps back what the operation may cost in gas, so a few cents stay in the old wallet.',
          'Open your positions again from the V5 wallet if you want them.',
        ],
      },

      { type: 'h2', text: 'Step 3 — Other networks' },
      {
        type: 'list',
        items: [
          'Each network has its own wallet. Switch network in the app, open your V5 wallet there and click "Deploy on this network". It uses the same address, passkey and guardians.',
          'Then repeat step 2 on that network, with "Send everything" from the old wallet there.',
        ],
      },

      { type: 'h2', text: 'Step 4 — Agents' },
      {
        type: 'list',
        items: [
          'Agent permissions stay on the old wallet. Authorize your agents again on the V5 wallet, choosing what each one can do.',
          'Change the wallet address in the agent\'s configuration (WALLET_ADDRESS for the MCP server, walletAddress in the SDK) to your V5 address.',
          'Revoke the agents on the old wallet once they work on the new one, so an old key cannot move what is left there.',
        ],
      },

      { type: 'h2', text: 'What stays the same' },
      {
        type: 'list',
        items: [
          'Your passkey: the same one signs both wallets. Do not delete it while the old wallet holds anything.',
          'Your guardians, unless you change them on the confirm screen.',
          'Your old wallet and its history. It is not closed or emptied for you.',
        ],
      },
    ],
  },
  es: {
    title: 'Pasar a la wallet V5',
    intro:
      'La V5 es la generación actual de la wallet. Una wallet no se puede actualizar por dentro, porque su dirección sale de tu passkey y de la factory que la creó. Lo que se hace es crear una wallet V5 con la misma passkey y pasar tus fondos a ella. Tu wallet antigua sigue funcionando y no se mueve nada sola.',
    blocks: [
      { type: 'h2', text: 'Antes de empezar' },
      {
        type: 'list',
        items: [
          'Passkey: necesitas la passkey que controla tu wallet actual, en este sitio. Si la wallet se recuperó con guardianes, es la passkey que se creó durante la recuperación.',
          'Gas: una wallet de navegador como MetaMask, con un poco de gas en la red, paga el despliegue y una transferencia pequeña con la que la wallet nueva paga su primera firma.',
          'Guardianes: la app los copia de tu wallet actual. Si no tiene, te pide tres.',
          'Dirección: tu dirección V5 es la misma en todas las redes. «Qué cambia», en el aviso de la V4, te la enseña antes de desplegar nada.',
        ],
      },

      { type: 'h2', text: 'Paso 1 — Crear la wallet V5' },
      {
        type: 'list',
        items: [
          'Abre tu wallet actual en la red por la que quieras empezar. Un aviso arriba te dice qué versión tienes.',
          'Pulsa «Crear wallet V5», en el aviso o en la ventana «Qué cambia».',
          'Revisa los guardianes y pulsa «Confirmar con passkey». La app comprueba que esa passkey controla tu wallet actual. Si no, te lo dice y no se despliega nada.',
          'Pulsa «Desplegar wallet» y confirma en tu wallet de navegador. Una segunda confirmación envía la transferencia pequeña a la wallet nueva, y después tu passkey firma el registro de los guardianes.',
          'Al terminar, la app abre tu wallet V5 nueva.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'La passkey se comprueba antes de gastar gas: nunca se despliega una wallet que no podrías firmar.',
      },

      { type: 'h2', text: 'Paso 2 — Pasar tus fondos' },
      {
        type: 'list',
        items: [
          'Vuelve a tu wallet antigua: en la pantalla de acceso pega su dirección y pulsa «Entrar». Tu passkey la sigue controlando.',
          'Cierra antes lo que tengas abierto allí: posiciones de liquidez en Uniswap y préstamos y depósitos en Aave. Son de la dirección antigua y no se mueven con los tokens.',
          'Pulsa «Enviar todo» en el aviso de arriba. Envía lo que la wallet antigua tiene en la red en la que estás, así que hazlo en cada red. Pega tu dirección V5, marca los tokens que quieres pasar y pulsa «Revisar». La app comprueba la operación antes de pedirte nada: si un token la haría fallar, lo desmarca y lo señala.',
          'Revisa la dirección y pulsa «Enviar con passkey». Todos los tokens marcados van en una sola operación que firmas una vez. En cada token se cobra la comisión habitual: 0,05% en una wallet personal y 0,15% en una agent wallet.',
          'La moneda nativa (ETH, BNB, POL) va la última y aparta lo que pueda costar la operación en gas, así que en la wallet antigua quedan unos céntimos.',
          'Si quieres, vuelve a abrir tus posiciones desde la wallet V5.',
        ],
      },

      { type: 'h2', text: 'Paso 3 — Otras redes' },
      {
        type: 'list',
        items: [
          'Cada red tiene su propia wallet. Cambia de red en la app, abre allí tu wallet V5 y pulsa «Desplegar en esta red». Usa la misma dirección, passkey y guardianes.',
          'Después repite el paso 2 en esa red, con «Enviar todo» desde la wallet antigua de allí.',
        ],
      },

      { type: 'h2', text: 'Paso 4 — Agentes' },
      {
        type: 'list',
        items: [
          'Los permisos de los agentes se quedan en la wallet antigua. Vuelve a autorizar tus agentes en la V5 y elige qué puede hacer cada uno.',
          'Cambia la dirección de la wallet en la configuración del agente (WALLET_ADDRESS en el servidor MCP, walletAddress en el SDK) por tu dirección V5.',
          'Revoca los agentes de la wallet antigua cuando funcionen en la nueva, para que una clave vieja no pueda mover lo que quede allí.',
        ],
      },

      { type: 'h2', text: 'Qué no cambia' },
      {
        type: 'list',
        items: [
          'Tu passkey: la misma firma las dos wallets. No la borres mientras la wallet antigua tenga algo.',
          'Tus guardianes, salvo que los cambies en la pantalla de confirmación.',
          'Tu wallet antigua y su historial. No se cierra ni se vacía por ti.',
        ],
      },
    ],
  },
}
