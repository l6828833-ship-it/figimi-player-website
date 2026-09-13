# NOWPayments Crypto Payment Integration

This document explains how to set up and use the NOWPayments crypto payment system for Figimi subscriptions.

## Overview

The integration allows users to pay for subscriptions using cryptocurrency. The payment flow is:

1. User selects a subscription plan (1 month, 6 months, 12 months, or lifetime)
2. User chooses "Cryptocurrency" as payment method
3. User selects their preferred cryptocurrency and network
4. System generates a payment address and QR code
5. User sends payment to the address
6. NOWPayments webhook notifies your system when payment is confirmed
7. Subscription is automatically activated

## Setup Instructions

### 1. Create NOWPayments Account

1. Visit https://nowpayments.io/
2. Sign up for an account
3. Complete KYC verification
4. Configure your store settings

### 2. Get API Credentials

1. Log in to NOWPayments dashboard
2. Go to **Settings → API**
3. Copy your **API Key**
4. Copy your **IPN Secret** (under Store Settings → IPN)

### 3. Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
NOWPAYMENTS_API_KEY=your_api_key_here
NOWPAYMENTS_IPN_SECRET=your_ipn_secret_here
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Important:** Never commit these values to git!

### 4. Enable Cryptocurrencies

1. In NOWPayments dashboard, go to **Settings → Currencies**
2. Select which cryptocurrencies you want to accept
3. Recommended for low fees and stability:
   - USDT (TRC20) - Tether on Tron network
   - BTC - Bitcoin
   - ETH - Ethereum
   - LTC - Litecoin

### 5. Configure IPN Webhook

1. In NOWPayments dashboard, go to **Settings → IPN**
2. Set IPN Callback URL to: `https://your-domain.com/api/nowpayments/ipn`
3. Make sure IPN is enabled

### 6. Test in Sandbox (Optional)

NOWPayments provides a sandbox environment for testing:

1. Use sandbox API key and IPN secret
2. Test with testnet cryptocurrencies
3. Switch to production when ready

## How It Works

### Frontend Flow

1. **Plan Selection**: User selects a subscription plan from the modal
2. **Payment Method**: User clicks "Cryptocurrency" button
3. **Currency Selection**: A new modal shows available cryptocurrencies with logos and networks
4. **Payment Generation**: System calls `/api/nowpayments/create-payment` to generate payment details
5. **Payment Display**: Shows QR code, amount, address, and memo (if required)
6. **Status Polling**: Automatically checks payment status every 10 seconds
7. **Success**: When paid, shows success message and refreshes subscription

### Backend Flow

1. **Currency List** (`/api/nowpayments/currencies`):
   - Fetches enabled cryptocurrencies from NOWPayments
   - Returns list with names, logos, and networks

2. **Create Payment** (`/api/nowpayments/create-payment`):
   - Creates payment in NOWPayments
   - Returns payment address, amount, and QR data

3. **Check Status** (`/api/nowpayments/status`):
   - Polls payment status from NOWPayments
   - Used for real-time updates

4. **IPN Webhook** (`/api/nowpayments/ipn`):
   - Receives payment notifications from NOWPayments
   - Verifies webhook signature
   - Updates subscription in database (TODO: implement)

## Integration with Database

The IPN webhook needs to be connected to your database. Update `/app/api/nowpayments/ipn/route.ts`:

```typescript
// Parse orderId to get deviceMac and planId
const [deviceMac, planId, timestamp] = orderId.split('-');

// Update device subscription in Supabase
await supabase
  .from('devices')
  .update({
    plan: planId,
    subscription_expires_at: calculateExpiration(planId),
    payment_confirmed_at: new Date().toISOString(),
  })
  .eq('mac', deviceMac);
```

## Pricing Configuration

Update pricing in `/components/device-playlist-manager.tsx`:

```typescript
const pricingPlans = [
  { id: "1month", duration: "1 Month", price: "$3", originalPrice: null },
  { id: "6months", duration: "6 Months", price: "$6", originalPrice: null },
  { id: "12months", duration: "12 Months", price: "$8", originalPrice: null },
  { id: "lifetime", duration: "Lifetime", price: "$20", originalPrice: "$30" },
];
```

## Security Considerations

1. **Never expose API keys** in client-side code
2. **Always verify IPN signatures** to prevent fake payments
3. **Use HTTPS** for all API calls
4. **Validate payment amounts** match your pricing
5. **Check payment status** is confirmed before activating subscription

## Troubleshooting

### Currencies Not Loading

- Check `NOWPAYMENTS_API_KEY` is set correctly
- Verify you've enabled currencies in NOWPayments dashboard
- Check browser console for API errors

### IPN Not Working

- Verify `NOWPAYMENTS_IPN_SECRET` is correct
- Check IPN URL is publicly accessible (not localhost)
- Review webhook signature verification code
- Check NOWPayments dashboard for IPN delivery status

### Payment Stuck in "Waiting"

- Check payment status in NOWPayments dashboard
- Verify IPN webhook is configured correctly
- Check server logs for IPN errors
- Manually poll status using `/api/nowpayments/status`

## Testing

To test the integration:

1. Use NOWPayments sandbox environment
2. Select a low-amount testnet cryptocurrency
3. Send test payment from testnet wallet
4. Verify payment is detected
5. Check subscription is activated

## Support

- NOWPayments Documentation: https://documenter.getpostman.com/view/7907941/2s93JusNJt
- NOWPayments Support: support@nowpayments.io
- Figimi Support: [Your support contact]
