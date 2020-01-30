const axios = require('axios')
const qs = require('querystring')

const COOKIE_REQUEST_VERIFICATION_TOKEN_NAME = '__RequestVerificationToken_L2VTdmMvV2Vi0'
const COOKIE_ASP_SESSIONID_NAME = 'ASP.NET_SessionId'

const COOKIE_PAYMENT_REQUEST_VERIFICATION_TOKEN_NAME = '__RequestVerificationToken_L2VTdmMvRVBheW1lbnRz0'

const constants = {
  COOKIE_REQUEST_VERIFICATION_TOKEN_NAME,
  COOKIE_ASP_SESSIONID_NAME,
  COOKIE_PAYMENT_REQUEST_VERIFICATION_TOKEN_NAME,
}

function SetCookieExtractor (setCookies) {
  return {
    get (name) {
      const [, value] = setCookies
        .find(v => v.startsWith(name))
        .replace(/;.*/, '')
        .split('=')
      return value
    },
  }
}

const findRequestVerificationToken = /<input name="__RequestVerificationToken" type="hidden" value="([^"]+)"/

const findPaymentRequestToken = /<input type="hidden" id="request" name="request" value="([^"]+)"/
const findPaymentResponseToken = /<input type="hidden" id="response" name="response" value="([^"]+)"/

const findRequestTransactionNumber = /id="RequestTransactionNumber" name="RequestTransactionNumber" type="hidden" value="([^"]+)"/
const findPayNowUserId = /id="UserId" name="UserId" type="hidden" value="([^"]+)"/

const findQRCode = /<img id="qr-code-image" src="([^"]+)"/
const findTransactionDate = /Transaction Date".*>([^<]+)<\/span/

const cpfEService = axios.create({
  baseURL: 'https://www.cpf.gov.sg/eSvc',
  withCredentials: true,
})

async function getDataForStartPage () {
  const response = await cpfEService.get('/Web/Miscellaneous/Cashier/ECashierHomepage')
  const [, requestVerificationToken] = findRequestVerificationToken.exec(response.data)

  const cookies = SetCookieExtractor(response.headers['set-cookie'])
  const cookieRVValue = cookies.get(COOKIE_REQUEST_VERIFICATION_TOKEN_NAME)
  const aspSessionId = cookies.get(COOKIE_ASP_SESSIONID_NAME)

  return {
    cookieRVValue,
    aspSessionId,
    requestVerificationToken,
  }
}

async function submitRSTURequest (params) {
  const {
    requestVerificationToken,
    recaptchaResponse,
    cpfAccountNumber,
    contactNumber,
    amount,
    cookies,
  } = params

  // TODO: take either CPF account number + recaptcha, or landing page payload
  // TODO: Take a hash of
  // https://www.cpf.gov.sg/Members/gen/TnC/RSTUCASH
  // and https://www.cpf.gov.sg/Members/others/member-pages/terms-of-use#PayNow
  // and compare it against what was given,
  // If the hash has changed, get the person to read it again

  const sessionConfig = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie:
        `${COOKIE_REQUEST_VERIFICATION_TOKEN_NAME}=${cookies[COOKIE_REQUEST_VERIFICATION_TOKEN_NAME]}; ` +
        `${COOKIE_ASP_SESSIONID_NAME}=${cookies[COOKIE_ASP_SESSIONID_NAME]}; `,
    },
  }

  const regexToMapper = regex => response => regex.exec(response.data)[1]

  // TODO: actually check if we had a good response from CPF
  const postToCPFAndExtractResponseTokens = async (
    path,
    data,
    config = sessionConfig,
    tokenNameToMapper = { token: regexToMapper(findRequestVerificationToken) },
  ) => {
    console.log(`Fetching from ${path} using ${JSON.stringify(config)}, ${data}`)
    const response = await cpfEService.post(path, data, config)
      .catch(error => {
        console.log(error.response.headers)
        throw error
      })
    console.log(response.headers)
    const result = {}
    Object.entries(tokenNameToMapper).forEach(([name, mapper]) => {
      result[name] = mapper(response)
    })
    return result
  }

  const { token: inputPageVerificationToken } = await postToCPFAndExtractResponseTokens(
    '/Web/Miscellaneous/Cashier/ECashierHomepage',
    qs.stringify({
      AccountNumberType: cpfAccountNumber[0],
      AccountNumber: cpfAccountNumber.substring(1),
      'g-recaptcha-response': recaptchaResponse,
      __RequestVerificationToken: requestVerificationToken,
      PayingAs: 'Member',
      SelectedScheme: '~/Schemes/TopUpSpecialAccount/LandingPageCashier?cpfAccountNumber={0}',
    }),
  )

  const { token: confirmationVerificationToken } = await postToCPFAndExtractResponseTokens(
    '/Web/Schemes/TopUpSpecialAccount/InputPage',
    qs.stringify({
      __RequestVerificationToken: inputPageVerificationToken,
      'ServiceInformation.IsTermsAndConditionsChecked': true,
    }),
  )

  const { token: webPaymentRequestVerificationToken } = await postToCPFAndExtractResponseTokens(
    '/Web/Schemes/TopUpSpecialAccount/Confirmation',
    qs.stringify({
      __RequestVerificationToken: confirmationVerificationToken,
      RecipientAccountNumber: cpfAccountNumber,
      ContactNumber: contactNumber,
      RecipientRelation: 1, // self
      IsDeclaration: true,
      IsTaxable: false,
      TopUpAmount: amount,
      ServiceInformation: 'CPF.eServices.Web.Common.Models.ServiceInformationModel',
      'Requestor.CpfAccountNumber': cpfAccountNumber,
    }),
  )

  const { paymentRequestToken, webPaymentResponseUrl } = await postToCPFAndExtractResponseTokens(
    '/Web/Schemes/TopUpSpecialAccount/PaymentRequest',
    qs.stringify({ __RequestVerificationToken: webPaymentRequestVerificationToken }),
    sessionConfig,
    {
      paymentRequestToken: regexToMapper(findPaymentRequestToken),
      webPaymentResponseUrl: response => response.request.res.responseUrl,
    },
  )

  const paymentSessionConfig = {
    headers: {
      ...sessionConfig.headers,
      Referer: webPaymentResponseUrl,
    },
  }
  const {
    paymentRequestPostRequestVerificationToken,
    requestTransactionNumber,
    paymentRequestVerificationTokenCookie,
  } = await postToCPFAndExtractResponseTokens(
    '/EPayments/epayment/paymentrequest',
    qs.stringify({ request: paymentRequestToken }),
    paymentSessionConfig,
    {
      paymentRequestPostRequestVerificationToken: regexToMapper(findRequestVerificationToken),
      requestTransactionNumber: regexToMapper(findRequestTransactionNumber),
      paymentRequestVerificationTokenCookie: response => {
        return SetCookieExtractor(response.headers['set-cookie'])
          .get(COOKIE_PAYMENT_REQUEST_VERIFICATION_TOKEN_NAME)
      },
    },
  )

  const txnSessionConfig = {
    headers: {
      ...sessionConfig.headers,
      Cookie: sessionConfig.headers.Cookie +
        `${COOKIE_PAYMENT_REQUEST_VERIFICATION_TOKEN_NAME}=${paymentRequestVerificationTokenCookie}; `,
    },
  }

  const { paymentResponseToken } = await postToCPFAndExtractResponseTokens(
    '/EPayments/epayment/PaymentRequestPost',
    qs.stringify({
      __RequestVerificationToken: paymentRequestPostRequestVerificationToken,
      RequestTransactionNumber: requestTransactionNumber,
      Amount: amount,
      UseENetsSoapi: false,
      ServiceId: 'MTP',
      'ViewModel.SelectedPaymentType': 'PayNowQR',
      'ViewModel.TermsAccepted': true,
      btnSubmit: 'Make Payment',
    }),
    txnSessionConfig,
    { paymentResponseToken: regexToMapper(findPaymentResponseToken) },
  )

  const paymentResponseHeaders = {
    ...txnSessionConfig.headers,
    Referer: 'https://www.cpf.gov.sg/eSvc/EPayments/epayment/PaymentRequestPost',
  }
  const { paynowRequestVerificationToken, userId } = await postToCPFAndExtractResponseTokens(
    '/Web/payment/PaymentResponsePayNowQR',
    qs.stringify({ response: paymentResponseToken }),
    { headers: paymentResponseHeaders },
    {
      paynowRequestVerificationToken: regexToMapper(findRequestVerificationToken),
      userId: regexToMapper(findPayNowUserId),
    },
  )

  const { transactionDate, qrCode } = await postToCPFAndExtractResponseTokens(
    '/Web/Schemes/TopUpSpecialAccount/PayNowQRTransaction',
    qs.stringify({
      __RequestVerificationToken: paynowRequestVerificationToken,
      UserId: userId,
      RequestTransactionNumber: requestTransactionNumber,
      TransactionAmount: amount,
      CpfAccountNumber: cpfAccountNumber,
      ServiceId: 'MTP',
      TransactionStatus: 'Success',
      TransactionDateTime: '1/1/0001 12:00:00 AM',
    }),
    txnSessionConfig,
    {
      transactionDate: regexToMapper(findTransactionDate),
      qrCode: regexToMapper(findQRCode),
    },
  )

  return {
    qrCode,
    requestTransactionNumber,
    transactionDate,
  }
}

module.exports = {
  constants,
  getDataForStartPage,
  submitRSTURequest,
}
