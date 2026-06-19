# @kodbee/jomabee

Official JavaScript / TypeScript client for the [Jomabee](https://kodbee.com)
payment API by **Kodbee**. Works in Node 18+ (uses the built-in `fetch`).

## Install

```bash
npm install @kodbee/jomabee
```

## Usage

```ts
import { Jomabee } from "@kodbee/jomabee";

const jomabee = new Jomabee({
  apiKey: process.env.JOMABEE_API_KEY!,
  secretKey: process.env.JOMABEE_SECRET_KEY!, // required for create/verify
  baseUrl: "https://pay.kodbee.com",
});

const payment = await jomabee.createPayment({
  amount: 500,
  product_name: "Premium Plan",
  customer_email: "karim@example.com",
  redirect_url: "https://yoursite.com/thank-you",
  callback_url: "https://yoursite.com/webhooks/jomabee",
});

// redirect the customer to payment.payment_url
```

```ts
await jomabee.paymentStatus("JOMB-XXXXXX");
await jomabee.verifyPayment("JOMB-XXXXXX", "TRXID123", "bkash");
await jomabee.transactions({ status: "verified", per_page: 50 });
await jomabee.balance();
```

## Webhooks (Node)

Verify the raw request body against the `X-Jomabee-Signature` header. **Use the
raw body string** — do not re-serialize the parsed object.

```ts
import { parseWebhook, SIGNATURE_HEADER } from "@kodbee/jomabee";

// Express example (with express.raw())
app.post("/webhooks/jomabee", express.raw({ type: "*/*" }), (req, res) => {
  try {
    const event = parseWebhook(
      req.body.toString("utf8"),
      req.header(SIGNATURE_HEADER) ?? "",
      process.env.JOMABEE_WEBHOOK_SECRET!,
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
import { JomabeeApiError } from "@kodbee/jomabee";

try {
  await jomabee.createPayment({ /* ... */ });
} catch (e) {
  if (e instanceof JomabeeApiError) {
    console.log(e.code, e.statusCode, e.message);
  }
}
```

## License

MIT © [Kodbee](https://kodbee.com)
