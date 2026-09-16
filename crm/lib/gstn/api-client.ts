// GSTN E-Invoice and E-Way Bill API Client
// API Documentation: https://einv-apisandbox.nic.in/

interface GSTNConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  gstin: string;
  username: string;
  password: string;
  isSandbox?: boolean;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user_gstin: string;
  auth_time: string;
}

interface EInvoiceRequest {
  Version: string;
  TranDtls: {
    TaxSch: string;
    SupTyp: string;
    RegRev?: string;
    EcmGstin?: string;
    IgstOnIntra?: string;
  };
  DocDtls: {
    Typ: string;
    No: string;
    Dt: string;
  };
  SellerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Addr1: string;
    Addr2?: string;
    Loc: string;
    Pin: number;
    Stcd: string;
    Ph?: string;
    Em?: string;
  };
  BuyerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Pos: string;
    Addr1: string;
    Addr2?: string;
    Loc: string;
    Pin: number;
    Stcd: string;
    Ph?: string;
    Em?: string;
  };
  ItemList: Array<{
    SlNo: string;
    PrdDesc?: string;
    IsServc: string;
    HsnCd: string;
    Barcde?: string;
    Qty?: number;
    FreeQty?: number;
    Unit?: string;
    UnitPrice?: number;
    TotAmt: number;
    Discount?: number;
    PreTaxVal?: number;
    AssAmt: number;
    GstRt: number;
    IgstAmt?: number;
    CgstAmt?: number;
    SgstAmt?: number;
    CesRt?: number;
    CesAmt?: number;
    CesNonAdvlAmt?: number;
    StateCesRt?: number;
    StateCesAmt?: number;
    StateCesNonAdvlAmt?: number;
    OthChrg?: number;
    TotItemVal: number;
  }>;
  ValDtls: {
    AssVal: number;
    CgstVal?: number;
    SgstVal?: number;
    IgstVal?: number;
    CesVal?: number;
    StCesVal?: number;
    Discount?: number;
    OthChrg?: number;
    RndOffAmt?: number;
    TotInvVal: number;
    TotInvValFc?: number;
  };
  PayDtls?: {
    Nm?: string;
    AccDet?: string;
    Mode?: string;
    FinInsBr?: string;
    PayTerm?: string;
    PayInstr?: string;
    CrTrn?: string;
    DirDr?: string;
    CrDay?: number;
    PaidAmt?: number;
    PaymtDue?: number;
  };
  RefDtls?: {
    InvRm?: string;
    DocPerdDtls?: {
      InvStDt: string;
      InvEndDt: string;
    };
    PrecDocDtls?: Array<{
      InvNo: string;
      InvDt: string;
      OthRefNo?: string;
    }>;
    ContrDtls?: Array<{
      RecAdvRefr?: string;
      RecAdvDt?: string;
      TendRefr?: string;
      ContrRefr?: string;
      ExtRefr?: string;
      ProjRefr?: string;
      PORefr?: string;
      PORefDt?: string;
    }>;
  };
  AddlDocDtls?: Array<{
    Url?: string;
    Docs?: string;
    Info?: string;
  }>;
  ExpDtls?: {
    ShipBNo?: string;
    ShipBDt?: string;
    Port?: string;
    RefClm?: string;
    ForCur?: string;
    CntCode?: string;
    ExpDuty?: number;
  };
  EwbDtls?: {
    TransId?: string;
    TransName?: string;
    TransMode?: string;
    Distance?: number;
    TransDocNo?: string;
    TransDocDt?: string;
    VehNo?: string;
    VehType?: string;
  };
}

interface EInvoiceResponse {
  success: boolean;
  message?: string;
  result?: {
    AckNo: number;
    AckDt: string;
    Irn: string;
    SignedInvoice: string;
    SignedQRCode: string;
    Status: string;
    EwbNo?: string;
    EwbDt?: string;
    EwbValidTill?: string;
  };
  error?: {
    error_code: string;
    error_message: string;
    error_source: string;
  };
}

interface EWayBillByIRN {
  Irn: string;
  Distance: number;
  TransMode: string;
  TransId?: string;
  TransName?: string;
  TransDocDt?: string;
  TransDocNo?: string;
  VehNo?: string;
  VehType?: string;
  ExpShipDtls?: {
    Addr1?: string;
    Addr2?: string;
    Loc?: string;
    Pin?: number;
    Stcd?: string;
  };
  DispDtls?: {
    Nm?: string;
    Addr1?: string;
    Addr2?: string;
    Loc?: string;
    Pin?: number;
    Stcd?: string;
  };
}

export class GSTNApiClient {
  private config: GSTNConfig;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: GSTNConfig) {
    this.config = {
      ...config,
      baseUrl: config.isSandbox
        ? 'https://einv-apisandbox.nic.in'
        : 'https://api.einvoice1.gst.gov.in'
    };
  }

  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.authToken;
    }

    const authEndpoint = `${this.config.baseUrl}/eivital/v1.04/auth`;

    // Prepare auth request
    const authRequest = {
      action: 'ACCESSTOKEN',
      username: this.config.username,
      password: this.config.password,
      app_key: this.encryptData(this.config.clientSecret),
      force_refresh_access_token: false
    };

    try {
      const response = await fetch(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client-id': this.config.clientId,
          'client-secret': this.config.clientSecret,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(authRequest)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data: AuthResponse = await response.json();
      this.authToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));

      return this.authToken;
    } catch (error) {
      console.error('GSTN Authentication Error:', error);
      throw error;
    }
  }

  private encryptData(data: string): string {
    // In production, implement proper AES-256 encryption
    // This is a placeholder for the actual encryption logic
    // GSTN requires specific encryption for sensitive data
    return Buffer.from(data).toString('base64');
  }

  private decryptData(data: string): string {
    // In production, implement proper AES-256 decryption
    // This is a placeholder for the actual decryption logic
    return Buffer.from(data, 'base64').toString();
  }

  async generateEInvoice(invoice: EInvoiceRequest): Promise<EInvoiceResponse> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eicore/v1.03/Invoice`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(invoice)
      });

      const data = await response.json();

      if (response.ok && data.Status === 'ACT') {
        return {
          success: true,
          result: data
        };
      } else {
        return {
          success: false,
          error: data.ErrorDetails || {
            error_code: 'UNKNOWN',
            error_message: 'Failed to generate e-invoice',
            error_source: 'API'
          }
        };
      }
    } catch (error) {
      console.error('Generate E-Invoice Error:', error);
      return {
        success: false,
        error: {
          error_code: 'SYSTEM_ERROR',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred',
          error_source: 'CLIENT'
        }
      };
    }
  }

  async cancelEInvoice(irn: string, reason: string, remarks?: string): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eicore/v1.03/Invoice/Cancel`;

    const cancelRequest = {
      Irn: irn,
      CnlRsn: reason,
      CnlRem: remarks
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(cancelRequest)
      });

      return await response.json();
    } catch (error) {
      console.error('Cancel E-Invoice Error:', error);
      throw error;
    }
  }

  async generateEWayBillByIRN(ewayBillData: EWayBillByIRN): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eiewb/v1.03/ewaybill`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(ewayBillData)
      });

      return await response.json();
    } catch (error) {
      console.error('Generate E-Way Bill by IRN Error:', error);
      throw error;
    }
  }

  async getEInvoiceByIRN(irn: string): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eicore/v1.03/Invoice/irn/${irn}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Get E-Invoice by IRN Error:', error);
      throw error;
    }
  }

  async getEWayBillByNumber(ewbNo: string): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eiewb/v1.03/ewayapi/GetEwayBill`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin,
          'ewbNo': ewbNo
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Get E-Way Bill Error:', error);
      throw error;
    }
  }

  async updateVehicleDetails(ewbNo: string, vehicleNo: string, fromPlace?: string, reason?: string): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eiewb/v1.03/ewayapi/UpdateVehicleNo`;

    const updateRequest = {
      ewbNo,
      vehicleNo,
      fromPlace,
      fromState: this.config.gstin.substring(0, 2),
      reasonCode: reason || 'BREAKDOWN',
      reasonRem: 'Vehicle update',
      transDocNo: '',
      transDocDate: '',
      transMode: '1'
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(updateRequest)
      });

      return await response.json();
    } catch (error) {
      console.error('Update Vehicle Details Error:', error);
      throw error;
    }
  }

  async cancelEWayBill(ewbNo: string, cancelRsnCode: string, cancelRmrk?: string): Promise<any> {
    const token = await this.authenticate();
    const endpoint = `${this.config.baseUrl}/eiewb/v1.03/ewayapi/CanEwayBill`;

    const cancelRequest = {
      ewbNo,
      cancelRsnCode,
      cancelRmrk: cancelRmrk || 'Cancellation requested'
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'user_name': this.config.username,
          'gstin': this.config.gstin
        },
        body: JSON.stringify(cancelRequest)
      });

      return await response.json();
    } catch (error) {
      console.error('Cancel E-Way Bill Error:', error);
      throw error;
    }
  }

  // Helper method to format invoice data from order
  formatEInvoiceFromOrder(order: any, customer: any, items: any[]): EInvoiceRequest {
    const stateCode = order.billing_state || customer.billing_state;
    const isInterstate = stateCode !== this.config.gstin.substring(0, 2);

    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: 'B2B',
        RegRev: 'N',
        IgstOnIntra: 'N'
      },
      DocDtls: {
        Typ: 'INV',
        No: order.invoice_number_gst || order.order_number,
        Dt: new Date().toISOString().split('T')[0].replace(/-/g, '/')
      },
      SellerDtls: {
        Gstin: this.config.gstin,
        LglNm: 'Your Company Name', // Replace with actual company name
        TrdNm: 'Your Trade Name',
        Addr1: 'Your Address Line 1',
        Loc: 'Your City',
        Pin: 560001, // Your pincode
        Stcd: this.config.gstin.substring(0, 2),
        Ph: '1234567890',
        Em: 'email@company.com'
      },
      BuyerDtls: {
        Gstin: customer.gst_number || 'URP', // URP for unregistered person
        LglNm: customer.company_name || `${customer.first_name} ${customer.last_name}`,
        Pos: stateCode,
        Addr1: order.billing_building_name || customer.billing_building_name,
        Addr2: order.billing_street_area || customer.billing_street_area,
        Loc: order.billing_city || customer.billing_city,
        Pin: parseInt(order.billing_pincode || customer.billing_pincode),
        Stcd: stateCode,
        Ph: customer.mobile_primary,
        Em: customer.email
      },
      ItemList: items.map((item, index) => ({
        SlNo: (index + 1).toString(),
        PrdDesc: item.product_name,
        IsServc: 'N',
        HsnCd: item.hsn_code || '9999',
        Qty: item.quantity,
        Unit: 'PCS',
        UnitPrice: parseFloat(item.unit_price),
        TotAmt: parseFloat(item.subtotal),
        AssAmt: parseFloat(item.subtotal),
        GstRt: parseFloat(item.gst_percentage || '18'),
        IgstAmt: isInterstate ? parseFloat(item.igst_amount || '0') : 0,
        CgstAmt: !isInterstate ? parseFloat(item.cgst_amount || '0') : 0,
        SgstAmt: !isInterstate ? parseFloat(item.sgst_amount || '0') : 0,
        TotItemVal: parseFloat(item.total)
      })),
      ValDtls: {
        AssVal: parseFloat(order.subtotal),
        CgstVal: !isInterstate ? parseFloat(order.cgst_amount || '0') : 0,
        SgstVal: !isInterstate ? parseFloat(order.sgst_amount || '0') : 0,
        IgstVal: isInterstate ? parseFloat(order.igst_amount || '0') : 0,
        Discount: parseFloat(order.discount_amount || '0'),
        OthChrg: parseFloat(order.shipping_charges || '0'),
        RndOffAmt: 0,
        TotInvVal: parseFloat(order.total_amount)
      }
    };
  }
}

export default GSTNApiClient;