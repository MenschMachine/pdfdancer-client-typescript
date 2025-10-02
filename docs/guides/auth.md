# Auth & Configuration (stub)

Minimal options to authenticate and point the client at your server.

## Token
- Environment variable: `PDFDANCER_TOKEN`
- Or pass explicitly as the first parameter to `ClientV1.create(token, ...)`.

## Base URL
- Default: `http://localhost:8080`
- Override via environment variable `PDFDANCER_BASE_URL` or the third parameter to `ClientV1.create`.

## Example
```ts
import { ClientV1 } from 'pdfdancer-client-typescript';

const token = process.env.PDFDANCER_TOKEN || 'your-auth-token';
const baseUrl = process.env.PDFDANCER_BASE_URL || 'http://localhost:8080';

// pdfData: Uint8Array | File | ArrayBuffer
async function connect(pdfData: Uint8Array) {
  const client = await ClientV1.create(token, pdfData, baseUrl, 30000);
  return client;
}
```
