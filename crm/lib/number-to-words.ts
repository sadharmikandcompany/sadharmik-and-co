/**
 * Convert number to words (Indian numbering system)
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

function convertLessThanOneThousand(num: number): string {
  if (num === 0) return '';

  if (num < 10) return ones[num];

  if (num < 20) return teens[num - 10];

  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
  }

  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  return ones[hundred] + ' Hundred' + (remainder > 0 ? ' ' + convertLessThanOneThousand(remainder) : '');
}

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  // Handle decimal part
  const parts = num.toString().split('.');
  const integerPart = parseInt(parts[0]);
  const decimalPart = parts[1] ? parseInt(parts[1]) : 0;

  if (integerPart === 0 && decimalPart === 0) return 'Zero';

  let result = '';

  // Indian numbering system: Crores, Lakhs, Thousands, Hundreds
  if (integerPart >= 10000000) {
    const crores = Math.floor(integerPart / 10000000);
    result += convertLessThanOneThousand(crores) + ' Crore ';
    const remaining = integerPart % 10000000;
    if (remaining > 0) {
      result += numberToWords(remaining);
    }
  } else if (integerPart >= 100000) {
    const lakhs = Math.floor(integerPart / 100000);
    result += convertLessThanOneThousand(lakhs) + ' Lakh ';
    const remaining = integerPart % 100000;
    if (remaining > 0) {
      result += numberToWords(remaining);
    }
  } else if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    result += convertLessThanOneThousand(thousands) + ' Thousand ';
    const remaining = integerPart % 1000;
    if (remaining > 0) {
      result += convertLessThanOneThousand(remaining);
    }
  } else {
    result = convertLessThanOneThousand(integerPart);
  }

  result = result.trim();

  // Add "Rupees"
  if (integerPart > 0) {
    result += ' Rupee' + (integerPart !== 1 ? 's' : '');
  }

  // Handle paise (decimal part)
  if (decimalPart > 0) {
    const paiseWords = convertLessThanOneThousand(decimalPart);
    if (paiseWords) {
      result += ' and ' + paiseWords + ' Paise';
    }
  } else {
    result += ' only';
  }

  return result;
}

// Get state code from state name
export function getStateCode(stateName: string): string {
  const stateCodes: Record<string, string> = {
    "Andhra Pradesh": "37",
    "Arunachal Pradesh": "12",
    "Assam": "18",
    "Bihar": "10",
    "Chhattisgarh": "22",
    "Goa": "30",
    "Gujarat": "24",
    "Haryana": "06",
    "Himachal Pradesh": "02",
    "Jharkhand": "20",
    "Karnataka": "29",
    "Kerala": "32",
    "Madhya Pradesh": "23",
    "Maharashtra": "27",
    "Manipur": "14",
    "Meghalaya": "17",
    "Mizoram": "15",
    "Nagaland": "13",
    "Odisha": "21",
    "Punjab": "03",
    "Rajasthan": "08",
    "Sikkim": "11",
    "Tamil Nadu": "33",
    "Telangana": "36",
    "Tripura": "16",
    "Uttar Pradesh": "09",
    "Uttarakhand": "05",
    "West Bengal": "19",
    "Andaman and Nicobar Islands": "35",
    "Chandigarh": "04",
    "Dadra and Nagar Haveli and Daman and Diu": "26",
    "Delhi": "07",
    "Jammu and Kashmir": "01",
    "Ladakh": "38",
    "Lakshadweep": "31",
    "Puducherry": "34",
  }
  return stateCodes[stateName] || "27"
}

export function formatStateWithCode(stateName: string): string {
  const code = getStateCode(stateName)
  return `${code}-${stateName}`
}

// Format currency for display
export function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
