# @kodbee/paydiver

Official JavaScript / TypeScript client for the [Paydiver](https://kodbee.com)
payment API by **Kodbee**. Works in Node 18+ (uses the built-in `fetch`).

## Install

```bash
npm install @kodbee/paydiver
```

## Usage

```ts
import { Paydiver } from "@kodbee/paydiver";

const paydiver = new Paydiver({
  apiKey: process.env.PAYDIVER_API_KEY!,
  secretKey: process.env.PAYDIVER_SECRET_KEY!, // required for create/verify
  baseUrl: "https://pay.kodbee.com",
});

const payment = await paydiver.createPayment({
  amount: 500,
  product_name: "Premium Plan",
  customer_email: "karim@example.com",
  redirect_url: "https://yoursite.com/thank-you",
  callback_url: "https://yoursite.com/webhooks/paydiver",
});

// redirect the customer to payment.payment_url
```

```ts
await paydiver.paymentStatus("PAYD-XXXXXX");
await paydiver.verifyPayment("PAYD-XXXXXX", "TRXID123", "bkash");
await paydiver.transactions({ status: "verified", per_page: 50 });
await paydiver.balance();
```

## Webhooks (Node)

Verify the raw request body against the `X-Paydiver-Signature` header. **Use the
raw body string** — do not re-serialize the parsed object.

```ts
import { parseWebhook, SIGNATURE_HEADER } from "@kodbee/paydiver";

// Express example (with express.raw())
app.post("/webhooks/paydiver", express.raw({ type: "*/*" }), (req, res) => {
  try {
    const event = parseWebhook(
      req.body.toString("utf8"),
      req.header(SIGNATURE_HEADER) ?? "",
      process.env.PAYDIVER_WEBHOOK_SECRET!,
    );
    // handle event.event === "payment.verified"
    res.sendStatus(200);
  } catch {
    res.sendStatus(400);
  }
});
```

`verifyWebhookSignature(rawBody, signature, secret)` returns a boolean if you
prefer to parse the body yourself.

## Errors

```ts
import { PaydiverApiError } from "@kodbee/paydiver";

try {
  await paydiver.createPayment({ /* ... */ });
} catch (e) {
  if (e instanceof PaydiverApiError) {
    console.log(e.code, e.statusCode, e.message);
  }
}
```

## License

MIT © [Kodbee](https://kodbee.com)
