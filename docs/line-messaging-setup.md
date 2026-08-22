# LINE Messaging Setup

This guide configures the Phase 3 LINE Messaging integration for RoomFlow. Do
not place real credentials in this repository, issue tracker, chat, screenshots,
CI logs, or `.env.example`.

RoomFlow does not use LINE Notify. It uses a LINE Official Account, a Messaging
API channel, a signed webhook, and push/reply messages through the LINE
Messaging API.

## 1. Create the LINE channel

1. Create a dedicated LINE Official Account for RoomFlow.
2. In LINE Official Account Manager, enable the Messaging API for that account.
3. Choose the correct LINE Developers provider carefully. LINE does not allow a
   Messaging API channel to be moved to another provider after this setup.
4. Open the generated channel in the LINE Developers Console.

Messaging API channels can no longer be created directly in the LINE Developers
Console. They are created by enabling the Messaging API for a LINE Official
Account. See the official [Getting started guide](https://developers.line.biz/en/docs/messaging-api/getting-started/).

## 2. Collect the configuration values

| RoomFlow variable | Where to get it | Treatment |
| --- | --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console -> channel -> Messaging API -> Channel access token | Secret. Used as the bearer credential for push and reply APIs. Prefer a managed-expiration v2.1 token when an operational rotation process exists. |
| `LINE_CHANNEL_SECRET` | LINE Developers Console -> channel -> Basic settings -> Channel secret | Secret. Used to verify the raw webhook body with HMAC-SHA256. Reissuing it immediately invalidates the old secret. |
| `LINE_BOT_BASIC_ID` | LINE Official Account Manager -> account settings -> Basic ID | Not a credential, but required by the UI. Include the leading `@`, for example `@roomflow`. |
| `BETTER_AUTH_SECRET` | Existing RoomFlow Fly secret | Secret. Must remain at least 32 characters because RoomFlow also uses it to HMAC-hash short-lived LINE link codes. Do not create a second value if production already has a strong one. |

Do not manually configure or store a LINE user ID. RoomFlow receives the user ID
from a signature-verified webhook after the user sends a single-use link code.

## 3. Configure Fly.io

The production Fly app is `room-booking-api`. From a trusted terminal, run:

```bash
cd api
fly auth whoami
fly secrets import --app room-booking-api
```

Then enter the following `NAME=VALUE` lines using the real values and finish
stdin with `Ctrl-D`:

```text
LINE_CHANNEL_ACCESS_TOKEN=<real-channel-access-token>
LINE_CHANNEL_SECRET=<real-channel-secret>
LINE_BOT_BASIC_ID=@<real-basic-id>
```

`fly secrets import` restarts or updates the application Machines unless the
secrets are staged. Confirm only the names and deployment state; Fly does not
show the secret values:

```bash
fly secrets list --app room-booking-api
```

Expected names include:

```text
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET
LINE_BOT_BASIC_ID
BETTER_AUTH_SECRET
```

Production must not set `NOTIFICATIONS_DISABLED=true`. That flag is intended for
automated tests and local environments that must never contact providers.

## 4. Configure the webhook

Deploy the Phase 3 API and migration before asking LINE to verify the endpoint.
In LINE Developers Console -> channel -> Messaging API:

1. Set **Webhook URL** to:

   ```text
   https://room-booking-api.fly.dev/api/line/webhook
   ```

2. Click **Verify** and require a successful response.
3. Enable **Use webhook**.
4. In LINE Official Account Manager, disable default auto-reply messages if they
   interfere with RoomFlow's `LINK` command. Greeting messages are optional.
5. Add the Official Account as a friend using its QR code or Basic ID.

The endpoint verifies `x-line-signature` against the exact raw request body
before parsing any event. LINE requires an HTTPS endpoint with a publicly trusted
certificate and expects webhook URL verification requests to return HTTP 200.
See the official [bot setup](https://developers.line.biz/en/docs/messaging-api/building-bot/),
[webhook URL verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/),
and [signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
documentation.

## 5. Verify the RoomFlow flow

Use a staging account and never production booking data for the first test:

1. Sign in to RoomFlow and open **Settings -> Notifications**.
2. Generate a LINE link code. The code expires after ten minutes and is
   single-use; generating another code invalidates the previous unused code.
3. Send the following message to the RoomFlow Official Account:

   ```text
   LINK ABCD2345
   ```

   Replace the example with the code shown by RoomFlow.

4. Confirm that the bot replies that linking succeeded and RoomFlow Settings now
   reports the LINE account as connected.
5. Queue a test notification from Settings and confirm that it arrives once.
6. Disconnect LINE in RoomFlow and confirm pending LINE jobs are cancelled and
   the UI reports the account as disconnected.

The application stores only the linked LINE user ID. Link codes are HMAC-hashed,
expire, and are atomically single-use. Automated tests suppress all real LINE and
email provider calls.

## 6. Rotation and troubleshooting

- Rotate a compromised channel access token in LINE, then immediately replace
  `LINE_CHANNEL_ACCESS_TOKEN` in Fly.
- Reissuing the channel secret invalidates the previous value. Replace
  `LINE_CHANNEL_SECRET` in Fly before verifying the webhook again.
- A webhook `401` normally means the channel secret is missing, belongs to a
  different channel, or the request body was modified before signature
  verification.
- A successful link with no later push message can mean that the user blocked
  the Official Account, notification preferences disabled LINE, or the worker
  exhausted delivery retries.
- Use `fly logs --app room-booking-api` for safe operational errors. Never add
  temporary logging for access tokens, secrets, raw link codes, or full webhook
  bodies.
- Use `fly secrets list --app room-booking-api` to verify secret names without
  exposing their values.
