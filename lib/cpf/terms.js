const axios = require('axios')
const cheerio = require('cheerio')

const getTerms = async () => {
  const [{ data: rstuTerms }, { data: useTerms }] = await Promise.all([
    axios.get('https://www.cpf.gov.sg/Members/gen/TnC/RSTUCASH'),
    axios.get('https://www.cpf.gov.sg/Members/others/member-pages/terms-of-use'),
  ])
  console.log('RSTU:', cheerio('section[aria-labelledby="cpfPageTitle"]', rstuTerms).text())
  console.log('PayNow:', cheerio('section[aria-labelledby="cpfPageTitle"]', useTerms).text())
}

module.exports = {
  getTerms,
}
