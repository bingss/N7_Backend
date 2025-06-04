module.exports = {
  clientID: process.env.GOOGLE_AUTH_CLIENTID || '434354166256-899de2kk6mol80imff48tqt9sods0alj.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_AUTH_CALLBACKURL || 'http://localhost:8080',
  signinupRedirectFrontUrl: process.env.GOOGLE_SIGNINUP_REDIRECTFRONTURL || 'https://yyl0911.github.io/LumiTix-vite/callback',
  bindRedirectFrontUrl:process.env.GOOGLE_BIND_REDIRECTFRONTURL || 'https://yyl0911.github.io/LumiTix-vite/callback',
  redirectAllowDomain : process.env.GOOGLE_REDIRECT_ALLOWDOMAIN || 'https://yyl0911.github.io',
}
