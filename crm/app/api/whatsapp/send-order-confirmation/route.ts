import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, getMyOperatorConfig } from '@/lib/services/myoperator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerName, orderNumber, mobileNumber } = body

    // Log received data for debugging
    console.log('[MyOperator WhatsApp] Order confirmation received:', { customerName, orderNumber, mobileNumber })

    // Validate required fields
    const missingFields = []
    if (!customerName) missingFields.push('customerName')
    if (!orderNumber) missingFields.push('orderNumber')
    if (!mobileNumber) missingFields.push('mobileNumber')

    if (missingFields.length > 0) {
      console.error('Missing fields:', missingFields)
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(', ')}`,
          received: { customerName, orderNumber, mobileNumber }
        },
        { status: 400 }
      )
    }

    // Extract OTP - last 3 digits of order number
    // Order number format: ORD-1762784788015
    const orderNumberDigits = orderNumber.replace(/\D/g, '') // Remove non-digits
    const otp = orderNumberDigits.slice(-3) // Last 3 digits

    // Construct the full order URL
    const orderUrl = `https://crm.sadharmikandcompany.com/order/${orderNumber}`

    const config = getMyOperatorConfig()

    if (!config.whatsappApiKey || !config.whatsappPhoneNumberId) {
      console.error('[MyOperator WhatsApp] Missing API credentials')
      return NextResponse.json(
        {
          success: false,
          error: 'MyOperator WhatsApp API not configured. Set MYOPERATOR_WHATSAPP_API_KEY and MYOPERATOR_WHATSAPP_PHONE_NUMBER_ID'
        },
        { status: 500 }
      )
    }

    // Clean phone number - remove non-digits and country code prefix
    let cleanPhone = mobileNumber.toString().replace(/\D/g, '')
    if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(2)
    }
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1)
    }

    const templateName = process.env.MYOPERATOR_WHATSAPP_TEMPLATE_ORDER_CONFIRMATION || 'whatsapp_1'

    // Send WhatsApp notification via MyOperator
    // Template params: {{var_1}} = customer name, {{var_2}} = order URL, {{var_3}} = OTP
    const result = await sendWhatsAppMessage(config, {
      customerNumber: cleanPhone,
      countryCode: '91',
      type: 'template',
      templateName: templateName,
      templateParams: {
        'var_1': customerName,
        'var_2': orderUrl,
        'var_3': otp,
      },
    })

    if (result.success) {
      console.log('[MyOperator WhatsApp] Order confirmation sent successfully:', result.messageId)
      return NextResponse.json({
        success: true,
        message: 'WhatsApp notification sent successfully',
        messageId: result.messageId,
        otp: otp
      })
    } else {
      console.error('[MyOperator WhatsApp] Failed to send:', result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send WhatsApp notification',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in WhatsApp API route:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
