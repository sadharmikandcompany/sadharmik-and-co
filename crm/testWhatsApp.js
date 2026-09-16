import whatsAppService from './whatsappService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Enable debug logging for testing
process.env.DEBUG = 'true';

/**
 * Test function to send WhatsApp message
 */
async function testWhatsAppMessage() {
  console.log('Starting WhatsApp test message...');

  // Test data
  const testPhoneNumber = '7977808166';

  // Create test order data
  const testOrderData = {
    order_number: 'ORD-1762784788015',
    items: [
      { productName: 'Test Product 1', quantity: 2 },
      { productName: 'Test Product 2', quantity: 1 }
    ]
  };

  // Create test customer data
  const testCustomerData = {
    fname: 'Test Customer',
    mobile_number: testPhoneNumber
  };

  try {
    console.log(`\nSending order confirmation to: ${testPhoneNumber}`);
    console.log('Order Number:', testOrderData.order_number);
    console.log('Customer Name:', testCustomerData.fname);

    // Send the order confirmation message
    const result = await whatsAppService.sendOrderConfirmation(
      testOrderData,
      testCustomerData
    );

    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ WhatsApp message sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ Failed to send WhatsApp message');
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Alternative: Send a direct template message with custom parameters
async function testDirectTemplateMessage() {
  console.log('\n--- Alternative: Direct Template Message ---');

  const testPhoneNumber = '8433804507';
  const templateName = 'order_7'; // Using the new utility template
  // Template ID: 1131448395802886
  // Template Type: Utility
  // Template Text: Hi {{1}}, Your order {{2}} has been successfully placed with Sadharmik & Company. Your Code {{3}} Thank You

  // Parameters for the template
  const parameters = {
    "1": "Test Customer",  // {{1}} - Customer name
    "2": "https://crm.sadharmikandcompany.com/dashboard",  // {{2}} - Link
    "3": "ABC123"          // {{3}} - Code
  };

  try {
    console.log(`\nSending template "${templateName}" to: ${testPhoneNumber}`);
    console.log('Parameters:', parameters);

    const result = await whatsAppService.sendTemplateMessage(
      testPhoneNumber,
      templateName,
      parameters
    );

    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Template message sent successfully!');
    } else {
      console.log('❌ Failed to send template message');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the tests
console.log('=== WhatsApp Service Test ===');
console.log('API URL:', process.env.OZONETEL_WHATSAPP_API_URL);
console.log('Kookoo ID:', process.env.OZONETEL_KOOKOO_ID);
console.log('API Key:', process.env.OZONETEL_API_KEY ? '***configured***' : 'NOT CONFIGURED');
console.log('Notifications Enabled:', process.env.WHATSAPP_NOTIFICATIONS_ENABLED);

// Run single test method
(async () => {
  // Test the order confirmation method with full URL and OTP
  await testWhatsAppMessage();

  console.log('\n=== Test Complete ===');
  process.exit(0);
})();