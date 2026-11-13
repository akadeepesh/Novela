"use client"

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next"

/** The writing app's routes. Nothing there is ever counted. */
const APP_PATHS = /^\/(dashboard|projects|settings|read)(\/|$)/

/**
 * Drops any event from the writing app (in case the script, once loaded on
 * a public page, sees a later client-side navigation into the app), and
 * strips query strings so nothing but the page path is sent.
 */
export function filterEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url, "https://example.invalid")
  if (APP_PATHS.test(url.pathname)) return null
  url.search = ""
  url.hash = ""
  return { ...event, url: event.url.startsWith("http") ? url.toString() : url.pathname }
}

/**
 * Vercel Web Analytics (cookieless) for the public pages only: landing,
 * guides, templates and legal. The writing app's layouts never include
 * this component. It does nothing until Web Analytics is turned on for the
 * project in Vercel, and nothing outside Vercel.
 */
export function Analytics() {
  return <VercelAnalytics beforeSend={filterEvent} />
}
