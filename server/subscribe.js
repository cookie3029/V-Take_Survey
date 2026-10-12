import { CONSENT_VERSION } from '../shared/subscription.js'
import { saveSubscription, SubscriptionConfigurationError } from './database.js'

const MAX_BODY_BYTES = 4096
const LOCAL_PART = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  })
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > 254) return null

  const parts = email.split('@')
  if (parts.length !== 2) return null
  const [local, domain] = parts
  if (
    !local || local.length > 64 || !LOCAL_PART.test(local) ||
    local.startsWith('.') || local.endsWith('.') || local.includes('..')
  ) return null

  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL.test(label))) return null
  return email
}

async function readPayload(request) {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new RequestError(413, '요청이 너무 큽니다.')
  }

  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, '올바른 요청을 보내 주세요.')

  let bytesRead = 0
  const chunks = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {})
        throw new RequestError(413, '요청이 너무 큽니다.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let payload
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new RequestError(400, '올바른 JSON 요청을 보내 주세요.')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestError(400, '올바른 요청을 보내 주세요.')
  }
  return payload
}

export function createSubscribeHandler({ persist = saveSubscription } = {}) {
  return async function subscribe(request) {
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, message: 'POST 요청만 지원합니다.' }, 405, { Allow: 'POST' })
    }

    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return jsonResponse({ ok: false, message: '허용되지 않은 요청입니다.' }, 403)
    }

    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/json') {
      return jsonResponse({ ok: false, message: 'JSON 형식으로 요청해 주세요.' }, 415)
    }

    let payload
    try {
      payload = await readPayload(request)
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 400
      const message = error instanceof RequestError ? error.message : '올바른 요청을 보내 주세요.'
      return jsonResponse({ ok: false, message }, status)
    }

    const email = normalizeEmail(payload.email)
    if (!email) {
      return jsonResponse({ ok: false, message: '올바른 이메일 주소를 입력해 주세요.' }, 400)
    }
    if (payload.consent !== true || payload.consentVersion !== CONSENT_VERSION) {
      return jsonResponse({ ok: false, message: '이메일 수집 및 알림 수신에 동의해 주세요.' }, 400)
    }

    try {
      await persist(email, CONSENT_VERSION)
    } catch (error) {
      const message = error instanceof SubscriptionConfigurationError
        ? '구독 서비스를 준비 중입니다. 잠시 후 다시 시도해 주세요.'
        : '지금은 구독을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      return jsonResponse({ ok: false, message }, 503)
    }

    // New and existing subscribers receive the same response.
    return jsonResponse({ ok: true })
  }
}
