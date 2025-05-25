module.exports = {
  clientID: process.env.GOOGLE_AUTH_CLIENTID || '434354166256-899de2kk6mol80imff48tqt9sods0alj.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_AUTH_CALLBACKURL || 'http://localhost:8080',
  frontUrl: process.env.GOOGLE_AUTH_FRONTURL || 'http://localhost:8080',
}
