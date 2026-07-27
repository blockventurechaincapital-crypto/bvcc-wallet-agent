// How an agent's permissions work — the four layers, call policies, and how to
// verify each contract on the explorer. Surfaced from the agent authorize form.
import type { LocalizedDoc } from '@/components/DocsPage'

export const agentPermissions: LocalizedDoc = {
  en: {
    title: 'How agent permissions work',
    intro:
      'A BVCC Agent Wallet gives an AI agent a narrow, on-chain-enforced set of powers. You do not hand it your keys — you authorize an agent address to do specific things, within limits the contract itself checks on every transaction. This page explains what those settings mean, so you can configure an agent understanding exactly what you grant.',
    blocks: [
      { type: 'h2', text: 'Capabilities instead of addresses' },
      {
        type: 'p',
        text: 'The authorize form leads with a simple question: what should this agent be able to do? Pick capabilities — swap on Uniswap, lend on Aave, unwind a position — and the form fills in the exact contracts, tokens and destinations each one needs. You never have to know that the Universal Router needs Permit2, or that Aave needs its Pool as a destination; the picker composes it for you.',
      },
      {
        type: 'p',
        text: 'Everything the picker adds is shown, and every address links to the explorer’s Contract tab so you can verify it is the real Uniswap, Aave or Permit2 contract. You can also add any address by hand in the "Addresses (manual / advanced)" section — for a protocol not yet in the list, for example.',
      },

      { type: 'h2', text: 'The four permission layers' },
      {
        type: 'p',
        text: 'Every action an agent attempts falls into one of four cases, each governed by a different setting:',
      },
      {
        type: 'table',
        headers: ['Case', 'What it is', 'What governs it'],
        rows: [
          ['1', 'Sending native ETH', 'Allowed destinations + ETH limits'],
          ['2', 'transfer(token)', 'Allowed destinations + token limits'],
          ['2b', 'approve(spender)', 'Allowed destinations + token limits'],
          ['3', 'DeFi calls (swaps, Aave…)', 'Allowed protocols + call policies'],
        ],
      },
      {
        type: 'p',
        text: 'Sending (cases 1 and 2) is always available; you shape it with destinations and limits. DeFi (case 3) is default-deny: whitelisting a protocol is not enough — a call policy per function must also be registered. The capability picker registers those policies for you.',
      },

      { type: 'h2', text: 'Call policies — why a stolen agent key cannot redirect funds' },
      {
        type: 'p',
        text: 'A call policy pins the destination argument of a DeFi call to your own wallet. So even if an agent’s key were stolen, a swap or an Aave withdrawal can only send the output back to your wallet — never to an attacker. For calls where the destination is buried in complex data (the Universal Router), a fixed on-chain validator decodes it and enforces the same rule.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'This is why the capability picker exists: getting these policies exactly right by hand is easy to get wrong, and a wrong or missing policy means the action simply reverts.',
      },

      { type: 'h2', text: 'Limits and destinations: what 0 and empty mean' },
      {
        type: 'list',
        items: [
          'A limit of 0 means unlimited — not zero. Leave it 0 to impose no cap; set a number to cap it.',
          'An empty destinations list means any destination is allowed. Add addresses only to restrict where the agent may send, transfer or approve.',
          'If you do restrict destinations, the contracts a capability needs (Aave Pool, Permit2, the swap routers) are added to that list automatically — their approve is a case-2b call.',
        ],
      },

      { type: 'h2', text: 'Verifying a contract' },
      {
        type: 'p',
        text: 'Click any address in the form or on an agent’s card. It opens the block explorer on the Contract tab, where you can confirm the address is the canonical, verified contract for that protocol before you authorize anything.',
      },
    ],
  },
  es: {
    title: 'Cómo funcionan los permisos del agente',
    intro:
      'Una BVCC Agent Wallet le da a un agente IA un conjunto de poderes reducido y verificado on-chain. No le entregas tus claves — autorizas una dirección de agente a hacer cosas concretas, dentro de límites que el propio contrato comprueba en cada transacción. Esta página explica qué significan esos ajustes, para que configures un agente entendiendo exactamente qué concedes.',
    blocks: [
      { type: 'h2', text: 'Capacidades en vez de direcciones' },
      {
        type: 'p',
        text: 'El formulario empieza con una pregunta simple: ¿qué quieres que sepa hacer este agente? Eliges capacidades — intercambiar en Uniswap, prestar en Aave, desmontar una posición — y el formulario rellena los contratos, tokens y destinos exactos que cada una necesita. Nunca tienes que saber que el Universal Router necesita Permit2, o que Aave necesita su Pool como destino; el selector lo compone por ti.',
      },
      {
        type: 'p',
        text: 'Todo lo que añade el selector se muestra, y cada dirección enlaza a la pestaña Contract del explorador para que verifiques que es el contrato real de Uniswap, Aave o Permit2. También puedes añadir cualquier dirección a mano en la sección "Direcciones (manual / avanzado)" — por ejemplo un protocolo que aún no esté en la lista.',
      },

      { type: 'h2', text: 'Las cuatro capas de permiso' },
      {
        type: 'p',
        text: 'Cada acción que intenta un agente cae en uno de cuatro casos, cada uno gobernado por un ajuste distinto:',
      },
      {
        type: 'table',
        headers: ['Caso', 'Qué es', 'Qué lo gobierna'],
        rows: [
          ['1', 'Enviar ETH nativo', 'Destinos permitidos + límites de ETH'],
          ['2', 'transfer(token)', 'Destinos permitidos + límites de token'],
          ['2b', 'approve(spender)', 'Destinos permitidos + límites de token'],
          ['3', 'Llamadas DeFi (swaps, Aave…)', 'Protocolos permitidos + call policies'],
        ],
      },
      {
        type: 'p',
        text: 'Enviar (casos 1 y 2) está siempre disponible; lo moldeas con destinos y límites. El DeFi (caso 3) es default-deny: whitelistar un protocolo no basta — hay que registrar además una call policy por función. El selector de capacidades registra esas policies por ti.',
      },

      { type: 'h2', text: 'Call policies — por qué una clave de agente robada no puede redirigir fondos' },
      {
        type: 'p',
        text: 'Una call policy ancla el argumento de destino de una llamada DeFi a tu propia wallet. Así, aunque robaran la clave de un agente, un swap o una retirada de Aave solo pueden mandar el resultado de vuelta a tu wallet — nunca a un atacante. Para llamadas donde el destino va enterrado en datos complejos (el Universal Router), un validator on-chain fijo lo decodifica y aplica la misma regla.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Por esto existe el selector de capacidades: acertar estas policies a mano es fácil de equivocar, y una policy errónea o ausente hace que la acción simplemente revierta.',
      },

      { type: 'h2', text: 'Límites y destinos: qué significan 0 y vacío' },
      {
        type: 'list',
        items: [
          'Un límite de 0 significa ilimitado — no cero. Déjalo en 0 para no imponer tope; pon un número para acotarlo.',
          'Una lista de destinos vacía significa que se permite cualquier destino. Añade direcciones solo para restringir a dónde puede enviar, transferir o aprobar el agente.',
          'Si restringes destinos, los contratos que una capacidad necesita (Aave Pool, Permit2, los routers de swap) se añaden a esa lista automáticamente — su approve es un caso 2b.',
        ],
      },

      { type: 'h2', text: 'Verificar un contrato' },
      {
        type: 'p',
        text: 'Clica cualquier dirección del formulario o de la tarjeta de un agente. Abre el explorador en la pestaña Contract, donde puedes confirmar que la dirección es el contrato canónico y verificado de ese protocolo antes de autorizar nada.',
      },
    ],
  },
}
