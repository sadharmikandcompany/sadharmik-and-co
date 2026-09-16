import axios from 'axios';
import logger from './lib/logger.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
/**
 * WhatsApp Service for Ozonetel Integration
 * Handles all WhatsApp notifications via Ozonetel API
 */

class WhatsAppService {
  constructor() {
    this.apiBaseUrl = process.env.OZONETEL_WHATSAPP_API_URL || 'https://in1-ccaaspro.ozonetel.com/whatsApp_API/v1/WhatsAppSendOzone/reply';
    this.apiKey = process.env.OZONETEL_API_KEY;
    this.kookooId = process.env.OZONETEL_KOOKOO_ID; // Format: OZNTLWA:91XXXXXXXXXX
    this.enabled = process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true';

    if (!this.apiKey || !this.kookooId) {
      logger.warn('WhatsApp Service: API credentials not configured. Notifications will be disabled.');
      logger.warn(`API Key: ${this.apiKey ? 'Present' : 'Missing'}, Kookoo ID: ${this.kookooId ? 'Present' : 'Missing'}`);
      this.enabled = false;
    } else if (!this.enabled) {
      logger.info('WhatsApp Service: Notifications disabled by configuration.');
    } else {
      logger.info('WhatsApp Service: Initialized successfully');
      logger.info(`API URL: ${this.apiBaseUrl}`);
      logger.info(`Kookoo ID: ${this.kookooId}`);
      logger.info(`Notifications: ${this.enabled ? 'Enabled' : 'Disabled'}`);
    }
  }

  /**
   * Format phone number to ensure it's in correct format
   * @param {string|number} phone - Phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Check if phone is valid
    if (!phone) {
      logger.warn(`WhatsApp Service: Invalid phone number: ${phone}`);
      return '';
    }
    
    // Convert to string if it's a number
    const phoneStr = typeof phone === 'number' ? phone.toString() : phone;
    
    // Check if it's a valid string after conversion
    if (typeof phoneStr !== 'string') {
      logger.warn(`WhatsApp Service: Invalid phone number type: ${typeof phone}`);
      return '';
    }
    
    // Remove all non-digit characters
    let cleaned = phoneStr.replace(/\D/g, '');
    
    // If number starts with 91, remove it (we'll add it back if needed)
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    
    // If number starts with 0, remove it
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // For Indian numbers, ensure it's 10 digits
    if (cleaned.length === 10) {
      return cleaned; // Return without country code for Ozonetel
    }
    
    return cleaned;
  }

  /**
   * Send a WhatsApp template message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} templateName - Template name
   * @param {Object} parameters - Template parameters
   * @returns {Promise<Object>} - Response from Ozonetel API
   */
  async sendTemplateMessage(phoneNumber, templateName, parameters = {}) {
    if (!this.enabled) {
      logger.info('WhatsApp Service: Notifications disabled. Skipping message.');
      return { success: false, message: 'WhatsApp notifications disabled' };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Check if phone number is valid after formatting
      if (!formattedPhone || formattedPhone.length < 10) {
        logger.warn(`WhatsApp Service: Invalid or missing phone number after formatting: ${phoneNumber}`);
        return { 
          success: false, 
          message: 'Invalid phone number',
          error: 'Phone number is required and must be valid'
        };
      }
      
      const payload = {
        recipient: {
          id: formattedPhone
        },
        kookoo_id: this.kookooId,
        type: "template",
        template: {
          name: templateName,
          language: "en_US",
          parameters: parameters
        }
      };

      logger.info(`WhatsApp Service: Sending template "${templateName}" to ${formattedPhone}`);
      logger.debug('WhatsApp Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(this.apiBaseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        timeout: 10000 // 10 second timeout
      });

      logger.info(`WhatsApp Service: Message sent successfully to ${formattedPhone}`);
      return {
        success: true,
        data: response.data,
        messageId: response.data?.id || response.data?.messageId || null
      };

    } catch (error) {
      logger.error('WhatsApp Service: Error sending message', {
        error: error.message,
        phone: phoneNumber,
        template: templateName,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Send order confirmation notification
   * @param {Object} orderData - Order data
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>}
   */
  async sendOrderConfirmation(orderData, customerData) {
    const templateName = process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION || 'order_7';

    // Format items list (if needed)
    const itemsList = orderData.items?.map((item, index) =>
      `${index + 1}. ${item.productName || 'Product'} x ${item.quantity}`
    ).join(', ') || '';

    // Construct the full order URL
    const orderUrl = `https://crm.sadharmikandcompany.com/order/${orderData.order_number}`;

    // Extract OTP from order number (last 3 digits)
    // Order number format: ORD-1762784788015
    const orderNumberDigits = orderData.order_number.replace(/\D/g, ''); // Remove non-digits
    const otp = orderNumberDigits.slice(-3); // Last 3 digits

    // Prepare parameters based on template "order_7"
    // Template: Hi {{1}}, Your order {{2}} has been successfully placed with Sadharmik & Company. Your Code {{3}} Thank You
    const parameters = {
      "1": customerData.fname || customerData.name || 'Customer',
      "2": orderUrl,  // Send full URL
      "3": otp        // OTP - last 3 digits of order number
    };

    return await this.sendTemplateMessage(
      customerData.mobile_number,
      templateName,
      parameters
    );
  }

  /**
   * Send order status update notification
   * @param {Object} orderData - Order data
   * @param {Object} customerData - Customer data
   * @param {string} status - New order status
   * @returns {Promise<Object>}
   */
  async sendOrderStatusUpdate(orderData, customerData, status) {
    const templateName = process.env.WHATSAPP_TEMPLATE_ORDER_STATUS || 'order_status_update';
    
    const parameters = {
      "1": customerData.fname || customerData.name || 'Customer',
      "2": orderData.order_number,
      "3": status
    };

    return await this.sendTemplateMessage(
      customerData.mobile_number,
      templateName,
      parameters
    );
  }

  /**
   * Send delivery notification
   * @param {Object} orderData - Order data
   * @param {Object} customerData - Customer data
   * @param {Object} deliveryPartner - Delivery partner data
   * @returns {Promise<Object>}
   */
  async sendDeliveryNotification(orderData, customerData, deliveryPartner) {
    const templateName = process.env.WHATSAPP_TEMPLATE_DELIVERY || 'order_out_for_delivery';
    
    const parameters = {
      "1": customerData.fname || customerData.name || 'Customer',
      "2": orderData.order_number,
      "3": deliveryPartner.fname || 'Delivery Partner',
      "4": deliveryPartner.mobile_number || ''
    };

    return await this.sendTemplateMessage(
      customerData.mobile_number,
      templateName,
      parameters
    );
  }

  /**
   * Send order delivered notification
   * @param {Object} orderData - Order data
   * @param {Object} customerData - Customer data
   * @returns {Promise<Object>}
   */
  async sendOrderDelivered(orderData, customerData) {
    const templateName = process.env.WHATSAPP_TEMPLATE_DELIVERED || 'order_delivered';
    
    const parameters = {
      "1": customerData.fname || customerData.name || 'Customer',
      "2": orderData.order_number
    };

    return await this.sendTemplateMessage(
      customerData.mobile_number,
      templateName,
      parameters
    );
  }
}

// Export singleton instance
export default new WhatsAppService();
