window.storeRecaptcha = recaptchaResponse =>
  window.localStorage.setItem('recaptchaResponse', recaptchaResponse)

window.submit = () => {
  const recaptchaResponse = window.localStorage.getItem('recaptchaResponse')
  const requestVerificationToken = document.getElementById('request-verification-token').getAttribute('data-value')
  const amount = Number(document.getElementById('amount').value)
  const contactNumber = Number(document.getElementById('contact-number').value)

  if (!window.localStorage.getItem('cpfAccountNumber')) {
    window.localStorage.setItem('cpfAccountNumber', document.getElementById('cpf-account-number').value)
  }

  const cpfAccountNumber = window.localStorage.getItem('cpfAccountNumber')

  if (recaptchaResponse && requestVerificationToken && amount && cpfAccountNumber) {
    axios.post(
      '/cpf/sa/rstu',
      {
        requestVerificationToken,
        recaptchaResponse,
        cpfAccountNumber,
        amount,
        contactNumber,
      },
    ).then(({ data }) => {
      const qr = document.createElement('img')
      qr.setAttribute('src', data.qrCode)
      qr.setAttribute('id', 'qr-code')
      const transactionDate = document.createElement('div')
      transactionDate.innerText = 'Transaction Date: ' + data.transactionDate
      const transactionNumber = document.createElement('div')
      transactionNumber.innerText = 'Transaction Number: ' + data.requestTransactionNumber
      const paynow = document.getElementById('paynow')
      paynow.appendChild(qr)
      paynow.appendChild(transactionDate)
      paynow.appendChild(transactionNumber)
    })
  } else {
    console.log('Not doing anything')
  }
  return false
}
