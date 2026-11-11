// Guardian recovery, step by step: how the owner, two guardians and the timelock move a wallet to a
// new passkey, network by network. Button names match the recovery page and the wallet screens.
import type { LocalizedDoc } from '@/components/DocsPage'

export const recovery: LocalizedDoc = {
  en: {
    title: 'Recover your wallet',
    intro:
      'A BVCC wallet is controlled by a single passkey. If you lose it, or want to move the wallet to a new passkey, two of your three guardians can make a new passkey the owner. The wallet keeps its address, funds, positions and history. Recovery takes 48 hours and is done on each network separately. The steps below are for V5 wallets, the current generation; older V4 wallets use the flow at the end of this page. The recovery page detects the generation and shows the right steps.',
    blocks: [
      { type: 'h2', text: 'Who does what' },
      {
        type: 'table',
        headers: ['Step', 'Who', 'What'],
        rows: [
          ['1', 'Owner', 'Creates the new passkey and sends the recovery code to two guardians'],
          ['2', 'Two guardians', 'Each votes for that key'],
          ['3', 'Nobody', '48-hour wait — the current owner can still cancel'],
          ['4', 'Any guardian', 'Executes the recovery'],
          ['5', 'Owner', 'Enters with the new passkey and resumes agents'],
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

      { type: 'h2', text: 'Step 1 — Create the new passkey (owner)' },
      {
        type: 'list',
        items: [
          'Open the recovery page: "Recover wallet" on the access screen, or Settings → "Manage recovery".',
          'Choose the network in the selector, paste the wallet address and click "Load". The guardians and their votes appear.',
          'In the owner section, click "Generate new passkey" and confirm it on your device.',
          'Copy the "Recovery code". It holds the new public key and the passkey id together, in three parts separated by ":". Send it to two of your guardians through a channel you trust.',
          'This device remembers the new passkey. Come back to this page on the same device once the recovery is executed.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'The code is a public key, not a secret, but the recovery installs exactly the key the guardians vote for. Check it with them through another channel.',
      },

      { type: 'h2', text: 'Step 2 — Vote (two guardians)' },
      {
        type: 'list',
        items: [
          'Each guardian opens the recovery page, chooses the same network, pastes the wallet address, clicks "Load" and connects their guardian account with "Connect MetaMask".',
          'In "I\'m a guardian — vote for the new key", paste the recovery code. The page says whether nobody has voted for that key yet or which key it is (Key A, Key B…) and how many votes it has.',
          'Compare the code with the owner over another channel (a call, or in person), tick "I checked this code with the owner through another channel" and click "Vote for this key".',
          'Each guardian has one vote. A guardian can move it to another key, or remove it with "Withdraw my vote". Nobody can change another guardian\'s vote.',
        ],
      },
      {
        type: 'p',
        text: 'The contract checks that the key is a valid P-256 public key when the vote is cast, so a damaged code is rejected at once.',
      },

      { type: 'h2', text: 'Step 3 — Wait 48 hours' },
      {
        type: 'list',
        items: [
          'When two guardians vote for the same key, the 48-hour wait starts. The dashboard shows a red banner with the countdown. Until the recovery is executed, the current passkey is still the owner and signs as usual.',
          'If you did not ask for this recovery, cancel it with your current passkey. That clears every vote.',
          'A third guardian cannot stop it or reset the votes of the other two. If one of the two voters withdraws or moves their vote, the wait stops; when two votes match again, a new 48-hour wait starts.',
          'The countdown uses your device clock, while the contract uses the network\'s time. If your clock is wrong, the countdown is wrong by the same amount.',
        ],
      },

      { type: 'h2', text: 'Step 4 — Execute (any guardian)' },
      {
        type: 'list',
        items: [
          'When the wait is over, any guardian opens the recovery page with the same network and address, connects and clicks "Execute recovery".',
          'The new key and its passkey id become the owner on that network in one step, and the old passkey no longer signs there. You do not need to save the guardians again afterwards.',
          'On an agent wallet, every agent is paused at that moment, so an agent authorized by whoever had your old passkey cannot keep spending.',
        ],
      },

      { type: 'h2', text: 'Step 5 — Back into the wallet (owner)' },
      {
        type: 'list',
        items: [
          'On the device where you created the passkey, open the recovery page again and click "Save new passkey and access →". From any other device, enter the wallet address on the access screen and click "Confirm with passkey", choosing the new passkey.',
          'Agent wallets: review your agents in Agents and resume them with the new passkey once you are happy with the list.',
          'Repeat steps 2 to 5 on every other network where the wallet exists, with the same recovery code.',
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

      { type: 'h2', text: 'V4 wallets: start and approve' },
      {
        type: 'p',
        text: 'Older V4 wallets use the previous flow: one guardian starts the recovery with the new key\'s X and Y coordinates, a second guardian approves, and after 48 hours a guardian executes. The steps are below. If you can, consider moving to V5 afterwards (see Move to wallet V5).',
      },
      { type: 'h3', text: 'V4 · Step 1 — Generate the new passkey (owner)' },
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

      { type: 'h3', text: 'V4 · Step 2 — Start the recovery (first guardian)' },
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

      { type: 'h3', text: 'V4 · Step 3 — Approve (second guardian)' },
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

      { type: 'h3', text: 'V4 · Step 4 — Wait 48 hours' },
      {
        type: 'list',
        items: [
          'The wallet shows "Recovery in progress" with the signatures and the time left. Until the recovery is executed, the current passkey is still the owner and signs as usual.',
          'If you did not ask for this recovery, click "Cancel recovery" there or in Settings. Only the current owner can, and this window exists for exactly that.',
          'If you did ask for it, do not cancel: cancelling clears both approvals and the process starts again.',
          'The countdown uses your device clock, while the contract uses the network\'s time. If your clock is wrong, the countdown is wrong by the same amount.',
        ],
      },

      { type: 'h3', text: 'V4 · Step 5 — Execute (any guardian)' },
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

      { type: 'h3', text: 'V4 · Step 6 — Back into the wallet (owner)' },
      {
        type: 'list',
        items: [
          'If you are still on the page where the recovery was executed, with the passkey generated there, click "Save new passkey and access →". Otherwise, on the access screen, enter the wallet address and click "Confirm with passkey", choosing the new passkey. The app checks it against the wallet before remembering it.',
          'Agent wallets: a recovery pauses every agent, so an agent authorized by whoever had your old passkey cannot keep spending. Review them in Agents and click "▶ Resume" once you are happy with the list.',
          'V4 wallets: in Settings → "Change guardians", save the same three guardians again. Signed with the new passkey, it records that passkey on-chain, so the app can find it when you enter by address from another browser.',
          'Repeat steps 2 to 6 on every other network where the wallet exists.',
        ],
      },

    ],
  },
  es: {
    title: 'Recuperar tu wallet',
    intro:
      'Una wallet BVCC la controla una sola passkey. Si la pierdes, o quieres pasar la wallet a una passkey nueva, dos de tus tres guardianes pueden hacer dueña a una passkey nueva. La wallet conserva su dirección, sus fondos, sus posiciones y su historial. La recuperación tarda 48 horas y se hace en cada red por separado. Los pasos siguientes son para wallets V5, la generación actual; las wallets V4, más antiguas, usan el flujo del final de esta página. La página de recuperación detecta la generación y muestra los pasos que corresponden.',
    blocks: [
      { type: 'h2', text: 'Quién hace qué' },
      {
        type: 'table',
        headers: ['Paso', 'Quién', 'Qué'],
        rows: [
          ['1', 'Dueño', 'Crea la passkey nueva y envía el código de recuperación a dos guardianes'],
          ['2', 'Dos guardianes', 'Cada uno vota esa clave'],
          ['3', 'Nadie', 'Espera de 48 horas — el dueño actual aún puede cancelar'],
          ['4', 'Cualquier guardián', 'Ejecuta la recuperación'],
          ['5', 'Dueño', 'Entra con la passkey nueva y reanuda los agentes'],
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

      { type: 'h2', text: 'Paso 1 — Crear la passkey nueva (dueño)' },
      {
        type: 'list',
        items: [
          'Abre la página de recuperación: «Recuperar wallet» en la pantalla de acceso, o Ajustes → «Gestionar recuperación».',
          'Elige la red en el selector, pega la dirección de la wallet y pulsa «Cargar». Aparecen los guardianes y sus votos.',
          'En la sección del dueño, pulsa «Generar nueva passkey» y confírmala en tu dispositivo.',
          'Copia el «Código de recuperación». Lleva juntos la clave pública nueva y el identificador de la passkey, en tres partes separadas por «:». Envíalo a dos de tus guardianes por un medio de confianza.',
          'Este dispositivo recuerda la passkey nueva. Vuelve a esta página en el mismo dispositivo cuando se ejecute la recuperación.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        text: 'El código es una clave pública, no un secreto, pero la recuperación instala exactamente la clave que votan los guardianes. Compruébalo con ellos por otro medio.',
      },

      { type: 'h2', text: 'Paso 2 — Votar (dos guardianes)' },
      {
        type: 'list',
        items: [
          'Cada guardián abre la página de recuperación, elige la misma red, pega la dirección de la wallet, pulsa «Cargar» y conecta su cuenta de guardián con «Conectar MetaMask».',
          'En «Soy guardián — votar la clave nueva», pega el código de recuperación. La página dice si nadie ha votado aún esa clave o qué clave es (Clave A, Clave B…) y cuántos votos tiene.',
          'Compara el código con el dueño por otro medio (una llamada, o en persona), marca «He comprobado este código con el dueño por otro medio» y pulsa «Votar esta clave».',
          'Cada guardián tiene un voto. Puede cambiarlo a otra clave o quitarlo con «Retirar mi voto». Nadie puede cambiar el voto de otro guardián.',
        ],
      },
      {
        type: 'p',
        text: 'El contrato comprueba que la clave es una clave pública P-256 válida al votar, así que un código dañado se rechaza en el momento.',
      },

      { type: 'h2', text: 'Paso 3 — Esperar 48 horas' },
      {
        type: 'list',
        items: [
          'Cuando dos guardianes votan la misma clave, empieza la espera de 48 horas. El dashboard muestra un aviso rojo con la cuenta atrás. Hasta que se ejecute la recuperación, la passkey actual sigue siendo la dueña y firma como siempre.',
          'Si no pediste esta recuperación, cancélala con tu passkey actual. Eso borra todos los votos.',
          'Un tercer guardián no puede pararla ni borrar los votos de los otros dos. Si uno de los dos que votaron retira o cambia su voto, la espera se detiene; cuando vuelvan a coincidir dos votos, empieza otra espera de 48 horas.',
          'La cuenta atrás usa el reloj de tu dispositivo y el contrato usa la hora de la red. Si tu reloj está mal, la cuenta atrás se desvía lo mismo.',
        ],
      },

      { type: 'h2', text: 'Paso 4 — Ejecutar (cualquier guardián)' },
      {
        type: 'list',
        items: [
          'Pasada la espera, cualquier guardián abre la página de recuperación con la misma red y dirección, conecta y pulsa «Ejecutar recovery».',
          'La clave nueva y el identificador de su passkey pasan a ser los dueños en esa red de una vez, y la passkey antigua deja de firmar allí. No hace falta volver a guardar los guardianes después.',
          'En una wallet de agentes, en ese momento se pausan todos los agentes, para que un agente autorizado por quien tuviera tu passkey antigua no pueda seguir gastando.',
        ],
      },

      { type: 'h2', text: 'Paso 5 — Volver a entrar (dueño)' },
      {
        type: 'list',
        items: [
          'En el dispositivo donde creaste la passkey, abre otra vez la página de recuperación y pulsa «Guardar nueva passkey y acceder →». Desde cualquier otro dispositivo, escribe la dirección de la wallet en la pantalla de acceso y pulsa «Confirmar con passkey», eligiendo la passkey nueva.',
          'Wallets de agentes: revisa tus agentes en Agentes y reanúdalos con la passkey nueva cuando estés conforme con la lista.',
          'Repite los pasos 2 a 5 en cada una de las otras redes donde exista la wallet, con el mismo código de recuperación.',
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

      { type: 'h2', text: 'Wallets V4: iniciar y aprobar' },
      {
        type: 'p',
        text: 'Las wallets V4, más antiguas, usan el flujo anterior: un guardián inicia la recuperación con las coordenadas X e Y de la clave nueva, un segundo guardián la aprueba y, pasadas 48 horas, un guardián la ejecuta. Los pasos están abajo. Si puedes, plantéate pasar después a la V5 (ver Pasar a la wallet V5).',
      },
      { type: 'h3', text: 'V4 · Paso 1 — Generar la passkey nueva (dueño)' },
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

      { type: 'h3', text: 'V4 · Paso 2 — Iniciar la recuperación (primer guardián)' },
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

      { type: 'h3', text: 'V4 · Paso 3 — Aprobar (segundo guardián)' },
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

      { type: 'h3', text: 'V4 · Paso 4 — Esperar 48 horas' },
      {
        type: 'list',
        items: [
          'La wallet muestra «Recuperacion en progreso» con las firmas y el tiempo que queda. Hasta que se ejecute, la passkey actual sigue siendo la dueña y firma con normalidad.',
          'Si no has pedido esta recuperación, pulsa «Cancelar recuperacion» ahí o en Ajustes. Solo puede hacerlo el dueño actual, y esta espera existe precisamente para eso.',
          'Si la has pedido tú, no la canceles: cancelar borra las dos aprobaciones y hay que empezar de nuevo.',
          'La cuenta atrás usa el reloj de tu dispositivo, y el contrato usa la hora de la red. Si tu reloj va mal, la cuenta atrás se desvía lo mismo.',
        ],
      },

      { type: 'h3', text: 'V4 · Paso 5 — Ejecutar (cualquier guardián)' },
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

      { type: 'h3', text: 'V4 · Paso 6 — Volver a entrar (dueño)' },
      {
        type: 'list',
        items: [
          'Si sigues en la página donde se ejecutó la recuperación, con la passkey generada en ella, pulsa «Guardar nueva passkey y acceder →». Si no, en la pantalla de acceso escribe la dirección de la wallet y pulsa «Confirmar con passkey», eligiendo la passkey nueva. La app la comprueba contra la wallet antes de recordarla.',
          'Wallets de agente: una recuperación pone en pausa todos los agentes, para que un agente autorizado por quien tuviera tu passkey antigua no pueda seguir gastando. Revísalos en Agentes y pulsa «▶ Reactivar» cuando la lista te parezca bien.',
          'Wallets V4: en Ajustes → «Cambiar guardianes», vuelve a guardar los mismos tres guardianes. Al firmarlo con la passkey nueva, la cadena registra esa passkey, y la app podrá encontrarla cuando entres con la dirección desde otro navegador.',
          'Repite los pasos 2 a 6 en cada una de las demás redes donde exista la wallet.',
        ],
      },

    ],
  },
}
