// Guardian recovery, step by step: how the owner, two guardians and the timelock move a wallet to a
// new passkey, network by network. Button names match the recovery page and the wallet screens.
import type { LocalizedDoc } from '@/components/DocsPage'

export const recovery: LocalizedDoc = {
  en: {
    title: 'Recover your wallet',
    intro:
      'A BVCC wallet is controlled by a single passkey. If you lose it, or want to move the wallet to a new passkey, two of your three guardians can make a new passkey the owner. The wallet keeps its address, funds, positions and history. Recovery takes 48 hours and is done on each network separately.',
    blocks: [
      { type: 'h2', text: 'Who does what' },
      {
        type: 'table',
        headers: ['Step', 'Who', 'What'],
        rows: [
          ['1', 'Owner', 'Generates the new passkey and shares its X and Y coordinates'],
          ['2', 'Guardian A', 'Starts the recovery with those coordinates'],
          ['3', 'Guardian B', 'Checks the coordinates with the owner and approves'],
          ['4', 'Nobody', '48-hour timelock — the current owner can still cancel'],
          ['5', 'Any guardian', 'Executes the recovery'],
          ['6', 'Owner', 'Enters with the new passkey, resumes agents, saves the guardians again'],
        ],
      },

      { type: 'h2', text: 'Before you start' },
      {
        type: 'list',
        items: [
          'Guardians: you need two of the three guardian addresses registered on the wallet, each in a browser wallet such as MetaMask, with a little gas on the network. If Settings says "Recovery is not set up", the wallet has no guardians and cannot be recovered.',
          'Networks: a wallet deployed on several networks has a separate owner on each one. Recover it on every network where it exists, using the same new passkey on all of them.',
          'Device: generate the new passkey on the device you will use from now on, on this site. A passkey only works on the site where it was created.',
          'Passkeys created before version 1.1.6 belonged to the whole blockventurechaincapital.com domain. The app no longer asks for them, because any site under that domain could. A wallet still controlled by one of them is moved to a new passkey with this same recovery.',
        ],
      },

      { type: 'h2', text: 'Step 1 — Generate the new passkey (owner)' },
      {
        type: 'list',
        items: [
          'Open the recovery page: "Recover wallet" on the access screen, or Settings → "Manage recovery".',
          'Choose the network in the selector, paste the wallet address and click "Load". The guardians and "No active recovery" appear.',
          'In "I\'m the owner — generate new key", click "Generate new passkey" and confirm it on your device.',
          'Copy "Coordinate X" and "Coordinate Y" and keep them until the recovery is finished on every network. They are only shown on this page: if you close it, you have to generate another passkey.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'The coordinates are a public key, not a secret — but the recovery installs exactly the key the guardian pastes. Send them over a channel you trust, and keep track of which passkey you shared: delete any extra one you generated only after you know it is not the one being installed.',
      },

      { type: 'h2', text: 'Step 2 — Start the recovery (first guardian)' },
      {
        type: 'list',
        items: [
          'Open the recovery page, choose the same network, paste the wallet address and click "Load".',
          'In "I\'m a guardian — sign recovery", click "Connect MetaMask" with the guardian account. If asked, switch the wallet to that network.',
          'Paste "New key X" and "New key Y", click "Initiate recovery" and confirm the transaction. This is the first of the two signatures.',
        ],
      },
      {
        type: 'p',
        text: 'The page refuses coordinates that are not a valid P-256 public key. Do not skip that check by starting the recovery elsewhere: a recovery approved with a broken key can never be executed, restarted or cancelled without the passkey you are replacing.',
      },

      { type: 'h2', text: 'Step 3 — Approve (second guardian)' },
      {
        type: 'list',
        items: [
          'Open the recovery page with the same network and address, and connect with a different guardian account.',
          'Compare "Key this recovery would install" with the coordinates the owner generated, over another channel — a call, or in person. Tick "I checked these coordinates with the owner through another channel" and click "Approve recovery".',
          'With two signatures, the 48-hour timelock starts.',
        ],
      },
      {
        type: 'p',
        text: 'approveRecovery takes no parameters, so a guardian can also call it from the block explorer, under the Write Contract tab, when the explorer shows the wallet\'s code as verified. Never use initiateRecovery there — while a recovery is in progress it starts over with whatever key is typed in, and the explorer does not check the key.',
      },

      { type: 'h2', text: 'Step 4 — Wait 48 hours' },
      {
        type: 'list',
        items: [
          'The wallet shows "Recovery in progress" with the signatures and the time left. Until the recovery is executed, the current passkey is still the owner and signs as usual.',
          'If you did not ask for this recovery, click "Cancel recovery" there or in Settings. Only the current owner can, and this window exists for exactly that.',
          'If you did ask for it, do not cancel: cancelling clears both approvals and the process starts again.',
          'The countdown uses your device clock, while the contract uses the network\'s time. If your clock is wrong, the countdown is wrong by the same amount.',
        ],
      },

      { type: 'h2', text: 'Step 5 — Execute (any guardian)' },
      {
        type: 'list',
        items: [
          'When the timelock has expired, any guardian opens the recovery page with the same network and address, connects, and clicks "Execute recovery".',
          'From that moment the new passkey owns the wallet on that network, and the old one no longer signs there.',
        ],
      },
      {
        type: 'p',
        text: 'executeRecovery also takes no parameters and can be called from the explorer\'s Write Contract tab.',
      },

      { type: 'h2', text: 'Step 6 — Back into the wallet (owner)' },
      {
        type: 'list',
        items: [
          'If you are still on the page where the recovery was executed, with the passkey generated there, click "Save new passkey and access →". Otherwise, on the access screen, enter the wallet address and click "Confirm with passkey", choosing the new passkey. The app checks it against the wallet before remembering it.',
          'Agent wallets: a recovery pauses every agent, so an agent authorized by whoever had your old passkey cannot keep spending. Review them in Agents and click "▶ Resume" once you are happy with the list.',
          'V4 wallets: in Settings → "Change guardians", save the same three guardians again. Signed with the new passkey, it records that passkey on-chain, so the app can find it when you enter by address from another browser.',
          'Repeat steps 2 to 6 on every other network where the wallet exists.',
        ],
      },

      { type: 'h2', text: 'After recovering on every network' },
      {
        type: 'list',
        items: [
          'Delete the old passkey from your devices once no network is controlled by it any more.',
          'The wallet cannot be deployed at the same address on a new network: the address comes from the key it was created with, and deploying it with that key would hand the new copy to the old passkey. The app warns about this instead of offering the deployment.',
        ],
      },
    ],
  },
  es: {
    title: 'Recuperar tu wallet',
    intro:
      'Una wallet BVCC la controla una sola passkey. Si la pierdes, o quieres pasar la wallet a una passkey nueva, dos de tus tres guardianes pueden hacer dueña a una passkey nueva. La wallet conserva su dirección, sus fondos, sus posiciones y su historial. La recuperación tarda 48 horas y se hace en cada red por separado.',
    blocks: [
      { type: 'h2', text: 'Quién hace qué' },
      {
        type: 'table',
        headers: ['Paso', 'Quién', 'Qué'],
        rows: [
          ['1', 'Dueño', 'Genera la passkey nueva y comparte sus coordenadas X e Y'],
          ['2', 'Guardián A', 'Inicia la recuperación con esas coordenadas'],
          ['3', 'Guardián B', 'Comprueba las coordenadas con el dueño y aprueba'],
          ['4', 'Nadie', '48 horas de espera — el dueño actual aún puede cancelar'],
          ['5', 'Cualquier guardián', 'Ejecuta la recuperación'],
          ['6', 'Dueño', 'Entra con la passkey nueva, reactiva los agentes y vuelve a guardar los guardianes'],
        ],
      },

      { type: 'h2', text: 'Antes de empezar' },
      {
        type: 'list',
        items: [
          'Guardianes: necesitas dos de las tres direcciones de guardián registradas en la wallet, cada una en una wallet de navegador como MetaMask y con algo de gas en la red. Si Ajustes dice «La recuperación no está configurada», la wallet no tiene guardianes y no se puede recuperar.',
          'Redes: una wallet desplegada en varias redes tiene un dueño distinto en cada una. Recupérala en todas las redes donde exista, con la misma passkey nueva en todas.',
          'Dispositivo: genera la passkey nueva en el dispositivo que vayas a usar a partir de ahora, en esta web. Una passkey solo funciona en la web donde se creó.',
          'Las passkeys creadas antes de la versión 1.1.6 pertenecían a todo el dominio blockventurechaincapital.com. La app ya no las pide, porque cualquier web de ese dominio podría hacerlo. Una wallet que siga controlada por una de ellas pasa a una passkey nueva con esta misma recuperación.',
        ],
      },

      { type: 'h2', text: 'Paso 1 — Generar la passkey nueva (dueño)' },
      {
        type: 'list',
        items: [
          'Abre la página de recuperación: «Recuperar wallet» en la pantalla de acceso, o Ajustes → «Gestionar recuperación».',
          'Elige la red en el selector, pega la dirección de la wallet y pulsa «Cargar». Aparecen los guardianes y «Sin recovery activo».',
          'En «Soy el dueño — generar nueva clave», pulsa «Generar nueva passkey» y confírmala en tu dispositivo.',
          'Copia la «Coordenada X» y la «Coordenada Y» y guárdalas hasta terminar la recuperación en todas las redes. Solo se muestran en esa página: si la cierras, tendrás que generar otra passkey.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Las coordenadas son una clave pública, no un secreto — pero la recuperación instala exactamente la clave que pegue el guardián. Envíalas por un canal de confianza y apunta qué passkey compartiste: borra cualquier passkey de más que generaras solo cuando sepas que no es la que se va a instalar.',
      },

      { type: 'h2', text: 'Paso 2 — Iniciar la recuperación (primer guardián)' },
      {
        type: 'list',
        items: [
          'Abre la página de recuperación, elige la misma red, pega la dirección de la wallet y pulsa «Cargar».',
          'En «Soy guardian — firmar recovery», pulsa «Conectar MetaMask» con la cuenta del guardián. Si lo pide, cambia la wallet a esa red.',
          'Pega «Nueva clave X» y «Nueva clave Y», pulsa «Iniciar recovery» y confirma la transacción. Es la primera de las dos firmas.',
        ],
      },
      {
        type: 'p',
        text: 'La página rechaza coordenadas que no sean una clave pública P-256 válida. No te saltes esa comprobación iniciando la recuperación desde otro sitio: una recuperación aprobada con una clave rota no se puede ejecutar, reiniciar ni cancelar nunca sin la passkey que quieres sustituir.',
      },

      { type: 'h2', text: 'Paso 3 — Aprobar (segundo guardián)' },
      {
        type: 'list',
        items: [
          'Abre la página de recuperación con la misma red y dirección, y conéctate con otra cuenta de guardián.',
          'Compara «Clave que instalaría este recovery» con las coordenadas que generó el dueño, por otro canal: una llamada o en persona. Marca «He verificado estas coordenadas con el propietario por otro canal» y pulsa «Aprobar recovery».',
          'Con dos firmas empiezan las 48 horas de espera.',
        ],
      },
      {
        type: 'p',
        text: 'approveRecovery no tiene parámetros, así que un guardián también puede llamarla desde el explorador de bloques, en la pestaña Write Contract, cuando el explorador muestre verificado el código de la wallet. No uses nunca initiateRecovery desde ahí — con una recuperación en curso la reinicia con la clave que se escriba, y el explorador no comprueba la clave.',
      },

      { type: 'h2', text: 'Paso 4 — Esperar 48 horas' },
      {
        type: 'list',
        items: [
          'La wallet muestra «Recuperacion en progreso» con las firmas y el tiempo que queda. Hasta que se ejecute, la passkey actual sigue siendo la dueña y firma con normalidad.',
          'Si no has pedido esta recuperación, pulsa «Cancelar recuperacion» ahí o en Ajustes. Solo puede hacerlo el dueño actual, y esta espera existe precisamente para eso.',
          'Si la has pedido tú, no la canceles: cancelar borra las dos aprobaciones y hay que empezar de nuevo.',
          'La cuenta atrás usa el reloj de tu dispositivo, y el contrato usa la hora de la red. Si tu reloj va mal, la cuenta atrás se desvía lo mismo.',
        ],
      },

      { type: 'h2', text: 'Paso 5 — Ejecutar (cualquier guardián)' },
      {
        type: 'list',
        items: [
          'Pasadas las 48 horas, cualquier guardián abre la página de recuperación con la misma red y dirección, se conecta y pulsa «Ejecutar recovery».',
          'Desde ese momento la passkey nueva es la dueña de la wallet en esa red, y la antigua deja de firmar ahí.',
        ],
      },
      {
        type: 'p',
        text: 'executeRecovery tampoco tiene parámetros y se puede llamar desde la pestaña Write Contract del explorador.',
      },

      { type: 'h2', text: 'Paso 6 — Volver a entrar (dueño)' },
      {
        type: 'list',
        items: [
          'Si sigues en la página donde se ejecutó la recuperación, con la passkey generada en ella, pulsa «Guardar nueva passkey y acceder →». Si no, en la pantalla de acceso escribe la dirección de la wallet y pulsa «Confirmar con passkey», eligiendo la passkey nueva. La app la comprueba contra la wallet antes de recordarla.',
          'Wallets de agente: una recuperación pone en pausa todos los agentes, para que un agente autorizado por quien tuviera tu passkey antigua no pueda seguir gastando. Revísalos en Agentes y pulsa «▶ Reactivar» cuando la lista te parezca bien.',
          'Wallets V4: en Ajustes → «Cambiar guardianes», vuelve a guardar los mismos tres guardianes. Al firmarlo con la passkey nueva, la cadena registra esa passkey, y la app podrá encontrarla cuando entres con la dirección desde otro navegador.',
          'Repite los pasos 2 a 6 en cada una de las demás redes donde exista la wallet.',
        ],
      },

      { type: 'h2', text: 'Cuando hayas recuperado en todas las redes' },
      {
        type: 'list',
        items: [
          'Borra la passkey antigua de tus dispositivos cuando ya no controle ninguna red.',
          'La wallet no se puede desplegar en la misma dirección en una red nueva: la dirección sale de la clave con la que se creó, y desplegarla con esa clave daría la copia nueva a la passkey antigua. La app avisa de ello en vez de ofrecer el despliegue.',
        ],
      },
    ],
  },
}
