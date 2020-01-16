const express = require('express')

const { transactions } = require('./cpf')

const router = express.Router()

const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY

router.get('/',
  async (_req, res) => {
    const {
      cookieRVValue,
      aspSessionId,
      requestVerificationToken,
    } = await transactions.getDataForStartPage()

    const cookieOptions = { httpOnly: true }

    res
      .cookie(transactions.constants.COOKIE_REQUEST_VERIFICATION_TOKEN_NAME, cookieRVValue, cookieOptions)
      .cookie(transactions.constants.COOKIE_ASP_SESSIONID_NAME, aspSessionId, cookieOptions)
      .render('index', { recaptchaSiteKey, requestVerificationToken })
  },
)

router.post('/cpf/sa/rstu',
  async (req, res) => {
    const {
      requestVerificationToken,
      recaptchaResponse,
      cpfAccountNumber,
      contactNumber,
      amount,
    } = req.body

    const cookies = {
      [transactions.constants.COOKIE_REQUEST_VERIFICATION_TOKEN_NAME]: req.cookies[transactions.constants.COOKIE_REQUEST_VERIFICATION_TOKEN_NAME],
      [transactions.constants.COOKIE_ASP_SESSIONID_NAME]: req.cookies[transactions.constants.COOKIE_ASP_SESSIONID_NAME],
    }
    // TODO: take either CPF account number + recaptcha, or landing page payload
    // TODO: Take a hash of
    // https://www.cpf.gov.sg/Members/gen/TnC/RSTUCASH
    // and https://www.cpf.gov.sg/Members/others/member-pages/terms-of-use#PayNow
    // and compare it against what was given,
    // If the hash has changed, get the person to read it again

    const rstuResponse = await transactions.submitRSTURequest({
      requestVerificationToken,
      recaptchaResponse,
      cpfAccountNumber,
      contactNumber,
      amount,
      cookies,
    })

    res.send(rstuResponse)
  },
)

module.exports = router
