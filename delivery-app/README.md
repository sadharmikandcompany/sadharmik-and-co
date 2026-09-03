# Sadharmik Delivery — Rider App

An Android app (Expo/React Native) for Sadharmik & Co. delivery partners:
see the orders assigned to you, call/navigate to the customer, and mark each
one Delivered or Failed. Talks to the `crm/` app's `/api/rider/*` routes —
see `crm/README.md` for that side.

## Running it locally (current phase)

1. Find your computer's LAN IP: on Windows, run `ipconfig` and note the
   "IPv4 Address" under your active WiFi adapter (e.g. `192.168.1.42`).
2. Edit `lib/config.ts` and replace `YOUR_COMPUTER_LAN_IP` with that address.
3. Start the CRM so it accepts connections from other devices on the
   network: `cd ../crm && npx next dev -H 0.0.0.0`. If Windows Firewall
   prompts you the first time, allow access on your private/home network.
4. In this folder, run `npx expo start`, then scan the QR code with the
   Expo Go app on an Android phone connected to the **same WiFi network**.
5. Create a rider in the CRM at `/users` (role "Delivery Partner"), assign
   them an order from that order's `/sales/<id>` page, then log into the
   app with that rider's phone/password.

## Next phase (not done yet)

Once the app works end-to-end locally: deploy `crm/` to Vercel's free tier,
point `lib/config.ts` at that URL instead, then build a signed release APK
with `eas build --local` (free, no Play Store account) and share the APK
file directly with riders to sideload.
