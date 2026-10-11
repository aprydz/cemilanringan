import { env } from '../config/env.js'

export type ShippingQuoteInput = {
  postalCode: string
  totalWeightGrams: number
}

export type ShippingQuote = {
  code: string
  courier: string
  service: string
  cost: number
  estimatedDays: { minimum: number; maximum: number }
  totalWeightGrams: number
}

export interface ShippingProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuote>
}

export class ConfiguredFlatRateShippingProvider implements ShippingProvider {
  async quote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    return {
      code: 'LOCAL_STANDARD',
      courier: 'Piscokshop',
      service: 'Standard',
      cost: env.SHIPPING_FLAT_RATE_IDR ?? 12000,
      estimatedDays: { minimum: 2, maximum: 5 },
      totalWeightGrams: input.totalWeightGrams,
    }
  }
}

export const shippingProvider: ShippingProvider = new ConfiguredFlatRateShippingProvider()