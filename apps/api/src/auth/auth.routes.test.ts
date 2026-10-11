import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { Server } from 'node:http'
import { createHash } from 'node:crypto'
import { app } from '../app.js'
import { verifyMidtransSignature } from '../payments/midtrans.provider.js'

test('authentication routes', async (suite) => {
  const server: Server = app.listen(0)
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port')
  const baseUrl = `http://127.0.0.1:${address.port}`

  suite.after(async () => {
    await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    })
  })

  await suite.test('health endpoint returns the standard success envelope', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'ok')
  })

  await suite.test('registration rejects client-supplied roles before database access', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'customer@example.com',
        password: 'a-long-development-password',
        role: 'ADMIN',
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.success, false)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('login rejects passwords exceeding bcrypt byte limit', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: '😊'.repeat(20),
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('protected profile route rejects requests without a bearer token', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`)
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.equal(body.message, 'Authentication is required')
  })

  await suite.test('refresh route rejects requests without the http-only refresh cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, { method: 'POST' })
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.equal(body.message, 'Refresh session is invalid or expired')
  })

  await suite.test('auth mutations reject untrusted browser origins', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    })
    const body = await response.json()

    assert.equal(response.status, 403)
    assert.equal(body.message, 'Request origin is not allowed')
  })

  await suite.test('catalog rejects inverted price ranges before database access', async () => {
    const response = await fetch(`${baseUrl}/api/products?minPrice=20000&maxPrice=10000`)
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('cart rejects invalid quantities before creating a guest session', async () => {
    const response = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId: 'variant-id', quantity: 0 }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
    assert.equal(response.headers.get('set-cookie'), null)
  })

  await suite.test('checkout rejects missing address and customer data before database access', async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('shipping quote rejects malformed postal codes before database access', async () => {
    const response = await fetch(`${baseUrl}/api/shipping/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postalCode: '1' }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('admin dashboard rejects unauthenticated requests before database access', async () => {
    const response = await fetch(`${baseUrl}/api/admin/dashboard`)
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.equal(body.message, 'Authentication is required')
  })

  await suite.test('Midtrans webhook signature accepts the exact signed transaction fields', async () => {
    const serverKey = 'test-midtrans-server-key'
    const payload = {
      order_id: 'PSK-ORDER-123',
      status_code: '200',
      gross_amount: '22000.00',
      signature_key: '',
    }
    payload.signature_key = createHash('sha512')
      .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
      .digest('hex')

    assert.equal(verifyMidtransSignature(payload as Parameters<typeof verifyMidtransSignature>[0], serverKey), true)
    assert.equal(verifyMidtransSignature(payload as Parameters<typeof verifyMidtransSignature>[0], 'wrong-server-key'), false)
  })

  await suite.test('payment initiation requires an idempotency key before database access', async () => {
    const response = await fetch(`${baseUrl}/api/payments/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderNumber: 'PSK-ORDER-123', paymentMethod: 'BANK_TRANSFER' }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })

  await suite.test('coupon validation rejects malformed codes before database access', async () => {
    const response = await fetch(`${baseUrl}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'x' }),
    })
    const body = await response.json()

    assert.equal(response.status, 422)
    assert.equal(body.message, 'Request validation failed')
  })
})