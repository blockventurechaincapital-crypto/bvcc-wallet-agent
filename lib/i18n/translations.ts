// Central i18n dictionary. Each namespace lives in its own file under ./ns
// so multiple pages can be translated independently without merge conflicts.
// Every ns file exports `{ en: { <ns>: {...} }, es: { <ns>: {...} } }`.
import { common } from './ns/common'
import { nav } from './ns/nav'
import { appshell } from './ns/appshell'
import { marketing } from './ns/marketing'
import { dashboard } from './ns/dashboard'
import { send } from './ns/send'
import { swap } from './ns/swap'
import { receive } from './ns/receive'
import { bridge } from './ns/bridge'
import { transactions } from './ns/transactions'
import { addressbook } from './ns/addressbook'
import { settings } from './ns/settings'
import { recovery } from './ns/recovery'
import { agents } from './ns/agents'
import { dapps } from './ns/dapps'
import { connect } from './ns/connect'
import { components } from './ns/components'
import { disclaimer } from './ns/disclaimer'
import { legal } from './ns/legal'

export type Lang = 'en' | 'es'

const parts = [
  common, nav, appshell, marketing, dashboard, send, swap, receive, bridge,
  transactions, addressbook, settings, recovery, agents, dapps, connect, components,
  disclaimer, legal,
]

function build(lang: Lang): Record<string, unknown> {
  return parts.reduce<Record<string, unknown>>((acc, p) => ({ ...acc, ...p[lang] }), {})
}

export const dict: Record<Lang, Record<string, unknown>> = {
  en: build('en'),
  es: build('es'),
}
