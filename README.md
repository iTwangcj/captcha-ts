# captcha-ts
Verification code generator

# Installation
npm install --save captcha-ts

# Example

```typescript
import * as fs from 'fs';
import { captcha } from 'captcha-ts/captcha';

async function test () {
    const { token, buffer } = await captcha();

    console.log(token, buffer);

    fs.createWriteStream('test.gif').on('finish', () => console.log(token)).end(buffer);
}

test();
```