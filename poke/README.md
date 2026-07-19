# Poke & Vanish

Mobile-first GitHub Pages prototype for creating playful disappearing poke links.

## Live URL

`https://naappe.github.io/Math/poke/`

## Current prototype

- Six poke moods
- Optional recipient first name and clue
- 140-character message limit
- Basic unsafe-content filtering
- UTF-8 message encoding inside the URL fragment
- Copy, WhatsApp, SMS and native-share actions
- One reveal per browser/device using `localStorage`
- 15-second animated disappearance
- Report/leave controls
- No database and no message upload

## Privacy boundary

This static prototype hides the author's identity inside the poke page, but the app used to share the link may reveal the sender's WhatsApp account or mobile number.

A truly branded or hidden delivery sender requires a registered SMS/WhatsApp Business provider and a secure server-side function. API secrets must never be added to GitHub Pages JavaScript.

## Production backend plan

1. Supabase Edge Function creates a short-lived message token.
2. Store encrypted content with expiry, one-open status and abuse controls.
3. Send only a one-time URL through a registered messaging provider.
4. Delete message content after the first successful reveal or expiry.
5. Apply sender verification, rate limits, recipient blocking and reporting.

## Safety

Designed for consensual fun between people who know each other. Do not use it for threats, harassment, impersonation, stalking, repeated unwanted contact, or sharing private information.
