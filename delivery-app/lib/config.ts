// Local development: replace YOUR_COMPUTER_LAN_IP with your computer's
// IPv4 address on the WiFi network your phone is also on (find it with
// `ipconfig` on Windows — look for "IPv4 Address" under your active
// network adapter). Your phone can't reach "localhost" — that would mean
// the phone itself, not your computer.
//
// Once the CRM is deployed (a later phase, not this one), replace this
// whole value with that deployed URL instead.
export const API_BASE_URL = "http://192.168.1.47:3000";
