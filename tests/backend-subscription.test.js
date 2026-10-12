import assert from 'node:assert/strict'
import test from 'node:test'
import endpoint from '../api/subscribe.js'
import { CONSENT_VERSION } from '../shared/subscription.js'
import { createSubscriptionStore } from '../server/database.js'
import { createSubscribeHandler } from '../server/subscribe.js'

const VALID_PAYLOAD = { email: 'creator@example.com', consent: true, consentVersion: CONSENT_VERSION }

function request(payload = VALID_PAYLOAD, options = {}) {
  return new Request('https://vtake.example/api/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
    // Preserve the default content type while allowing overrides.
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
}

test('Vercel endpoint exposes the Web Standard fetch handler', () => {
  assert.equal(typeof endpoint.fetch, 'function')
})

test('only POST JSON requests are accepted; errors never write to the database', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  const get = await handler(new Request('https://vtake.example/api/subscribe'))
  assert.equal(get.status, 405)
  assert.equal(get.headers.get('allow'), 'POST')
  assert.equal(get.headers.get('cache-control'), 'no-store')

  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'application/jsonp']) {
    const response = await handler(request(VALID_PAYLOAD, { headers: { 'Content-Type': contentType } }))
    assert.equal(response.status, 415)
  }
  assert.equal(writes, 0)
})

test('cross-origin browser requests are rejected and same-origin JSON is accepted', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  const blocked = await handler(request(VALID_PAYLOAD, { headers: { Origin: 'https://other.example' } }))
  assert.equal(blocked.status, 403)
  assert.equal(blocked.headers.get('access-control-allow-origin'), null)
  assert.equal(writes, 0)

  const accepted = await handler(request(VALID_PAYLOAD, {
    headers: { Origin: 'https://vtake.example', 'Content-Type': 'application/json; charset=utf-8' },
  }))
  assert.equal(accepted.status, 200)
  assert.equal(writes, 1)
})

test('malformed JSON and non-object payloads fail without a database write', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  for (const payload of [null, [], 'creator@example.com', 42, true]) {
    assert.equal((await handler(request(payload))).status, 400)
  }
  const malformed = await handler(request({}, { body: '{"email":' }))
  assert.equal(malformed.status, 400)
  assert.equal(writes, 0)
})

test('invalid email values and addresses are rejected', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  const emails = [
    null, 2, {}, [], '', '  ', 'creator', 'creator@example',
    'creator@@example.com', 'creator @example.com', '.creator@example.com',
    'creator..name@example.com', 'creator@example..com', 'creator@-example.com',
    `${'a'.repeat(65)}@example.com`, `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`,
  ]
  for (const email of emails) {
    const response = await handler(request({ ...VALID_PAYLOAD, email }))
    assert.equal(response.status, 400, `Expected rejection for ${JSON.stringify(email)}`)
    assert.equal((await response.json()).ok, false)
  }
  assert.equal(writes, 0)
})

test('explicit true consent and the current consent version are required', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  const payloads = [
    { email: VALID_PAYLOAD.email, consentVersion: CONSENT_VERSION },
    { ...VALID_PAYLOAD, consent: false },
    { ...VALID_PAYLOAD, consent: 'true' },
    { ...VALID_PAYLOAD, consent: 1 },
    { ...VALID_PAYLOAD, consentVersion: undefined },
    { ...VALID_PAYLOAD, consentVersion: '2026-10-11' },
  ]
  for (const payload of payloads) assert.equal((await handler(request(payload))).status, 400)
  assert.equal(writes, 0)
})

test('body size is bounded with and without a Content-Length header', async () => {
  let writes = 0
  const handler = createSubscribeHandler({ persist: async () => { writes += 1; return true } })
  const declared = await handler(request(VALID_PAYLOAD, { headers: { 'Content-Length': '4097' } }))
  assert.equal(declared.status, 413)

  const streamed = await handler(request({ ...VALID_PAYLOAD, padding: '가'.repeat(1500) }))
  assert.equal(streamed.status, 413)
  assert.equal(writes, 0)
})

test('email is normalized and success waits for persistence; response contains no subscriber data', async () => {
  let complete
  let stored
  const storedPromise = new Promise((resolve) => { complete = resolve })
  const handler = createSubscribeHandler({
    persist: async (email, consentVersion) => {
      stored = { email, consentVersion }
      await storedPromise
      return true
    },
  })
  let responded = false
  const pending = handler(request({ ...VALID_PAYLOAD, email: '  Creator+News@Example.COM  ' }))
    .then((response) => { responded = true; return response })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(stored, { email: 'creator+news@example.com', consentVersion: CONSENT_VERSION })
  assert.equal(responded, false)
  complete()
  const response = await pending
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { ok: true })
})

test('missing database configuration is lazy and returns a safe 503', async () => {
  let reads = 0
  let created = 0
  const diagnostics = []
  const persist = createSubscriptionStore({
    getDatabaseUrl: () => { reads += 1; return undefined },
    createSql: () => { created += 1; throw new Error('Must not initialize') },
  })
  const handler = createSubscribeHandler({ persist, reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic) })
  assert.equal(reads, 0)
  assert.equal((await handler(request({ ...VALID_PAYLOAD, consent: false }))).status, 400)
  assert.equal(reads, 0)
  assert.deepEqual(diagnostics, [])
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    ok: false,
    message: '구독 서비스를 준비 중입니다. 잠시 후 다시 시도해 주세요.',
  })
  assert.equal(reads, 1)
  assert.equal(created, 0)
  assert.deepEqual(diagnostics, [{ event: 'subscription_save_failed', category: 'configuration_missing' }])
})

test('database errors do not leak database credentials or the submitted email', async () => {
  const diagnostics = []
  const secret = 'secret creator@example.com postgres://private-user:secret@example/database'
  const persist = createSubscriptionStore({
    getDatabaseUrl: () => 'postgres://private-user:secret@example/database',
    createSql: () => async () => {
      throw Object.assign(new Error(secret), {
        name: secret,
        detail: secret,
        hint: secret,
        internalQuery: secret,
        sourceError: new Error(secret),
      })
    },
  })
  const handler = createSubscribeHandler({
    persist,
    reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    ok: false,
    message: '지금은 구독을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  })
  assert.deepEqual(diagnostics, [{ event: 'subscription_save_failed', category: 'persistence_failure' }])
  assert.doesNotMatch(JSON.stringify(diagnostics), /secret|creator@example\.com|postgres:\/\//)
})

test('known SQLSTATE errors produce only the fixed diagnostic fields', async () => {
  const cases = [
    ['42P01', 'table_missing'],
    ['42703', 'column_missing'],
    ['42P10', 'unique_constraint_missing'],
    ['42501', 'permission_denied'],
    ['28P01', 'authentication_failed'],
    ['28000', 'authentication_failed'],
    ['08000', 'connection_failure'],
    ['08001', 'connection_failure'],
    ['08003', 'connection_failure'],
    ['08004', 'connection_failure'],
    ['08006', 'connection_failure'],
    ['08007', 'connection_failure'],
    ['08P01', 'connection_failure'],
  ]
  for (const [code, category] of cases) {
    const diagnostics = []
    const secret = 'secret creator@example.com postgres://private-user:secret@example/database'
    const handler = createSubscribeHandler({
      persist: async () => {
        throw Object.assign(new Error(secret), { code, name: secret, detail: secret, hint: secret })
      },
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    })
    const response = await handler(request())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      ok: false,
      message: '지금은 구독을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    })
    assert.deepEqual(diagnostics, [{ event: 'subscription_save_failed', category, sqlState: code }])
    assert.doesNotMatch(JSON.stringify(diagnostics), /secret|creator@example\.com|postgres:\/\//)
  }
})

test('unrecognized or malformed SQLSTATE fields are omitted from diagnostics', async () => {
  for (const code of [undefined, null, 42, '', '42p01', '42P01\n', 'ZZZZZ', '08ZZZ', 'creator@example.com', 'postgres://secret']) {
    const diagnostics = []
    const handler = createSubscribeHandler({
      persist: async () => { throw Object.assign(new Error('secret'), { code }) },
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    })
    assert.equal((await handler(request())).status, 503)
    assert.deepEqual(diagnostics, [{ event: 'subscription_save_failed', category: 'persistence_failure' }])
  }
})

test('diagnostic reporter exceptions preserve the safe 503 response', async () => {
  for (const reportDiagnostic of [
    () => { throw new Error('secret reporter failure') },
    async () => { throw new Error('secret reporter failure') },
  ]) {
    const handler = createSubscribeHandler({
      persist: async () => { throw new Error('secret database failure') },
      reportDiagnostic,
    })
    const response = await handler(request())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      ok: false,
      message: '지금은 구독을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    })
  }
})

test('the default reporter logs only the sanitized diagnostic to console.error', async (t) => {
  const reporter = t.mock.method(console, 'error', () => {})
  const handler = createSubscribeHandler({
    persist: async () => { throw Object.assign(new Error('secret creator@example.com'), { code: '42P01' }) },
  })
  assert.equal((await handler(request())).status, 503)
  assert.equal(reporter.mock.calls.length, 1)
  assert.deepEqual(reporter.mock.calls[0].arguments, [
    { event: 'subscription_save_failed', category: 'table_missing', sqlState: '42P01' },
  ])
})

test('concurrent duplicate requests return one success and seven conflicts through one atomic insert each', async () => {
  const calls = []
  let initialized = 0
  const stored = new Set()
  const persist = createSubscriptionStore({
    getDatabaseUrl: () => 'postgres://offline-test/database',
    createSql: () => {
      initialized += 1
      return async (strings, ...values) => {
        calls.push({ text: strings.join('?'), values })
        const wasPresent = stored.has(values[0])
        stored.add(values[0])
        return wasPresent ? [] : [{ id: 1 }]
      }
    },
  })
  const handler = createSubscribeHandler({ persist })
  const payload = { ...VALID_PAYLOAD, email: "O'Hara@Example.com" }
  const responses = await Promise.all(Array.from({ length: 8 }, () => handler(request(payload))))
  assert.equal(responses.filter((response) => response.status === 200).length, 1)
  assert.equal(responses.filter((response) => response.status === 409).length, 7)
  for (const response of responses) {
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), response.status === 200 ? { ok: true } : {
      ok: false,
      code: 'ALREADY_SUBSCRIBED',
      message: '이미 신청하셨습니다.',
    })
  }
  assert.equal(initialized, 1)
  assert.equal(calls.length, 8)
  assert.equal(stored.size, 1)
  for (const call of calls) {
    assert.match(call.text, /INSERT INTO public\.email_subscriptions/)
    assert.match(call.text, /ON CONFLICT \(email\) DO NOTHING/)
    assert.match(call.text, /RETURNING id/)
    assert.doesNotMatch(call.text, /SELECT|UPDATE|o'hara|2026-10-12/i)
    assert.deepEqual(call.values, ["o'hara@example.com", CONSENT_VERSION])
  }
})

test('a normalized existing email returns the duplicate warning without changing its original consent', async () => {
  const original = Object.freeze({
    id: 42,
    email: 'creator@example.com',
    created_at: '2026-10-01T00:00:00.000Z',
    consented_at: '2026-10-01T00:00:00.000Z',
    consent_version: '2026-10-01',
  })
  const stored = new Map([[original.email, original]])
  const calls = []
  const diagnostics = []
  const persist = createSubscriptionStore({
    getDatabaseUrl: () => 'postgres://offline-test/database',
    createSql: () => async (strings, ...values) => {
      const text = strings.join('?')
      calls.push({ text, values })
      assert.match(text, /ON CONFLICT \(email\) DO NOTHING/)
      assert.doesNotMatch(text, /SELECT|UPDATE/i)
      return stored.has(values[0]) ? [] : [{ id: 43 }]
    },
  })
  const handler = createSubscribeHandler({
    persist,
    reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  })
  const response = await handler(request({ ...VALID_PAYLOAD, email: '  Creator@EXAMPLE.COM  ' }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'ALREADY_SUBSCRIBED',
    message: '이미 신청하셨습니다.',
  })
  assert.deepEqual(calls.map((call) => call.values), [['creator@example.com', CONSENT_VERSION]])
  assert.equal(stored.size, 1)
  assert.equal(stored.get(original.email), original)
  assert.deepEqual(diagnostics, [])
})
