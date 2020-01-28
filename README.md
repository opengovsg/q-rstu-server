# qRSTU Prototype
A proof-of-concept (PoC) demonstrating an alternative interface to 
[CPF e-cashier](https://www.cpf.gov.sg/eSvc/Web/Cashier/ECashierHomepage)
that wraps around the original, focusing on payments into members' own CPF 
Special Accounts (CPF SA) via the Retirement Sum Top-Up scheme (RSTU)

## Quickstart

```bash
export RECAPTCHA_SITE_KEY=<site key scraped from CPF e-cashier>
PORT=29125 node index.js
# Visit http://localhost:29125
```

## Brief Explanation

Each request in a session on the e-Cashier page requires the following:
  - Content-Type set to `application/x-www-form-urlencoded`
  - Cookies for:
    - the ASP.NET session identifier;
    - tokens that verify the requests being made to CPF's e-Cashier and
      payment pages;
  - a token embedded in form data that verifies the authenticity of the 
    request being made, scraped from each page returned by the previous 
    request, and;
  - in some cases, the correct referer to be set.

In this PoC, we scrape the e-Cashier pages for the above, finally taking
the PayNow QR code that a user can use to deposit money into the CPF SA
