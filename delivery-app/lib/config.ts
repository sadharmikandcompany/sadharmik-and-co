// Points at the live production CRM. The rider backend (/api/rider/*) only
// exists there once that code has actually been pushed and deployed — until
// then, a build of this app will show a working login screen but every
// request will fail, since those routes 404 on production.
//
// For local testing against `next dev` instead, temporarily swap this for
// http://YOUR_COMPUTER_LAN_IP:3001 (find the IP with `ipconfig` — your phone
// can't reach "localhost", that would mean the phone itself) and start the
// CRM with `next dev -H 0.0.0.0` so it accepts LAN connections.
export const API_BASE_URL = "https://crm.sadharmikandcompany.com";
