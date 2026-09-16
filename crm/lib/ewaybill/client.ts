/**
 * E-Way Bill API Client for GSTN Official API
 * Documentation: https://docs.ewaybillgst.gov.in/apidocs/
 */

import crypto from 'crypto'

interface AuthResponse {
  authToken: string
  sek: string
  tokenExpiry: number
}

interface EWayBillResponse {
  ewayBillNo: number
  ewayBillDate: string
  validUpto: string
  alert?: string
}

export class EWayBillClient {
  private baseUrl: string
  private gstin: string
  private username: string
  private password: string
  private authToken: string | null = null
  private sek: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    // Use sandbox URL for testing, production URL when going live
    this.baseUrl = process.env.EWAYBILL_API_URL || 'https://api.mastergst.com/ewaybillapi/v1.03'
    this.gstin = process.env.EWAYBILL_GSTIN || ''
    this.username = process.env.EWAYBILL_USERNAME || ''
    this.password = process.env.EWAYBILL_PASSWORD || ''

    if (!this.gstin || !this.username || !this.password) {
      console.warn('E-Way Bill credentials not configured. Please set environment variables.')
    }
  }

  /**
   * Authenticate with GSTN and get auth token
   */
  private async authenticate(): Promise<void> {
    // Check if token is still valid
    if (this.authToken && this.tokenExpiry > Date.now()) {
      return
    }

    try {
      const response = await fetch(`${this.baseUrl}/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      })

      if (!response.ok) {
        throw new Error('Authentication failed')
      }

      const data: AuthResponse = await response.json()
      this.authToken = data.authToken
      this.sek = data.sek
      // Token typically expires in 6 hours
      this.tokenExpiry = Date.now() + (6 * 60 * 60 * 1000)
    } catch (error) {
      console.error('E-Way Bill authentication error:', error)
      throw new Error('Failed to authenticate with E-Way Bill API')
    }
  }

  /**
   * Encrypt payload using SEK
   */
  private encryptPayload(payload: string): string {
    if (!this.sek) {
      throw new Error('SEK not available. Please authenticate first.')
    }

    const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(this.sek, 'base64'), null)
    let encrypted = cipher.update(payload, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  }

  /**
   * Decrypt response using SEK
   */
  private decryptResponse(encryptedData: string): string {
    if (!this.sek) {
      throw new Error('SEK not available. Please authenticate first.')
    }

    const decipher = crypto.createDecipheriv('aes-256-ecb', Buffer.from(this.sek, 'base64'), null)
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  /**
   * Make API request
   */
  private async makeRequest(endpoint: string, method: string, payload?: any): Promise<any> {
    await this.authenticate()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'gstin': this.gstin,
    }

    if (this.authToken) {
      headers['authtoken'] = this.authToken
    }

    const requestBody = payload ? {
      data: this.encryptPayload(JSON.stringify(payload))
    } : undefined

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'API request failed')
      }

      const data = await response.json()

      // Decrypt response if encrypted
      if (data.data) {
        const decryptedData = this.decryptResponse(data.data)
        return JSON.parse(decryptedData)
      }

      return data
    } catch (error: any) {
      console.error('E-Way Bill API error:', error)
      throw new Error(error.message || 'Failed to communicate with E-Way Bill API')
    }
  }

  /**
   * Generate E-Way Bill
   */
  async generateEWayBill(payload: any): Promise<EWayBillResponse> {
    return this.makeRequest('/ewayapi', 'POST', payload)
  }

  /**
   * Get E-Way Bill details
   */
  async getEWayBill(ewbNo: string): Promise<any> {
    return this.makeRequest(`/ewayapi?ewbNo=${ewbNo}`, 'GET')
  }

  /**
   * Cancel E-Way Bill
   */
  async cancelEWayBill(ewbNo: string, cancelRsnCode: string, cancelRmrk: string): Promise<any> {
    return this.makeRequest('/ewayapi/cancel', 'POST', {
      ewbNo,
      cancelRsnCode,
      cancelRmrk,
    })
  }

  /**
   * Update vehicle details
   */
  async updateVehicle(ewbNo: string, vehicleNo: string, reasonCode: string, reasonRem: string): Promise<any> {
    return this.makeRequest('/ewayapi/updatevehicle', 'POST', {
      ewbNo,
      vehicleNo,
      reasonCode,
      reasonRem,
    })
  }

  /**
   * Update transporter
   */
  async updateTransporter(ewbNo: string, transporterId: string): Promise<any> {
    return this.makeRequest('/ewayapi/updatetransporter', 'POST', {
      ewbNo,
      transporterId,
    })
  }

  /**
   * Extend validity of E-Way Bill
   */
  async extendValidity(
    ewbNo: string,
    vehicleNo: string,
    fromPlace: string,
    fromState: string,
    reasonCode: string,
    reasonRem: string,
    transitType: string,
    transitDocNo?: string,
    transitDocDate?: string
  ): Promise<any> {
    return this.makeRequest('/ewayapi/extendvalidity', 'POST', {
      ewbNo,
      vehicleNo,
      fromPlace,
      fromState,
      reasonCode,
      reasonRem,
      transitType,
      transitDocNo,
      transitDocDate,
    })
  }

  /**
   * Consolidate E-Way Bills
   */
  async consolidateEWayBills(ewbNos: string[], vehicleNo: string, fromPlace: string, fromState: string): Promise<any> {
    return this.makeRequest('/ewayapi/consolidate', 'POST', {
      ewbNos,
      vehicleNo,
      fromPlace,
      fromState,
    })
  }
}

// Singleton instance
let ewaybillClient: EWayBillClient | null = null

export function getEWayBillClient(): EWayBillClient {
  if (!ewaybillClient) {
    ewaybillClient = new EWayBillClient()
  }
  return ewaybillClient
}
