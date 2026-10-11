import { createHash, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

export type MidtransItem = { id: string; price: number; quantity: number; name: string }

export type MidtransTransactionInput = {
  orderId: string
  amount: number
  customer: { name: string; email: string; phone: string }
  items: MidtransItem[]
  paymentMethod: 'BANK_TRANSFER' | 'GOPAY' | 'QRIS' | 'CREDIT_CARD'
}

export type MidtransTransaction = {
  transactionId: string
  checkoutUrl: string
  expiresAt: Date
  rawResponse: Record<string, unknown>
}

export type MidtransNotification = {
  order_id: string
  transaction_id: string
  transaction_status: string
  status_code: string
  gross_amount: string
  signature_key: string
  fraud_status?: string
  settlement_time?: string
}

export function verifyMidtransSignature(notification: MidtransNotification, serverKey: string) {
  const expected = createHash('sha512')
    .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
    .digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(notification.signature_key, 'hex')
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export class MidtransProvider {
  constructor(private readonly serverKey = env.PAYMENT_SERVER_KEY) {}

  get isConfigured() {
    return Boolean(this.serverKey)
  }

  async createTransaction(input: MidtransTransactionInput): Promise<MidtransTransaction> {
    if (!this.serverKey) throw new HttpError(503, 'Payment provider is not configured')

    const auth = Buffer.from(`${this.serverKey}:`).toString('base64')
    const response = await fetch(`${env.PAYMENT_API_BASE_URL.replace(/\/$/, '')}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': input.orderId,
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.amount },
        customer_details: input.customer,
        item_details: input.items,
        enabled_payments: {
          BANK_TRANSFER: ['bank_transfer'],
          GOPAY: ['gopay'],
          QRIS: ['qris'],
          CREDIT_CARD: ['credit_card'],
        }[input.paymentMethod],
        expiry: { unit: 'minute', duration: 30 },
      }),
      signal: AbortSignal.timeout(10_000),
    })

    const body: unknown = await response.json().catch(() => null)
    const responseData = typeof body === 'object' && body !== null ? body as Record<string, unknown> : null
    if (!response.ok || responseData === null || typeof responseData.redirect_url !== 'string') {
      throw new HttpError(502, 'Payment provider could not create a transaction')
    }

    return {
      transactionId: input.orderId,
      checkoutUrl: responseData.redirect_url,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      rawResponse: responseData,
    }
  }
}

export const midtransProvider = new MidtransProvider()