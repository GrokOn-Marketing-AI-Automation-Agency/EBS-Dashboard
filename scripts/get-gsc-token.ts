/**
 * One-time OAuth token generator — adds Search Console scope to existing credentials.
 * Run: bun run scripts/get-gsc-token.ts
 * Then open the printed URL in your browser and authorize.
 */

const CLIENT_ID     = process.env.GADS_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET ?? ''

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  GADS_CLIENT_ID and GADS_CLIENT_SECRET must be set in .env')
  process.exit(1)
}

const PORT     = 8080
const REDIRECT = `http://localhost:${PORT}/callback`
const SCOPES   = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ')

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n──────────────────────────────────────────────────────────')
console.log('  Google OAuth — Search Console + Ads scope')
console.log('──────────────────────────────────────────────────────────')
console.log('\nStep 1: Open this URL in your browser:\n')
console.log(authUrl)
console.log('\nStep 2: Sign in and click Allow')
console.log('Step 3: This script will capture the code automatically\n')
console.log('Waiting for callback on http://localhost:8080 ...\n')

// Start local callback server
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url  = new URL(req.url)
    const code = url.searchParams.get('code')
    const err  = url.searchParams.get('error')

    if (err) {
      console.error(`\n❌  Authorization denied: ${err}`)
      setTimeout(() => process.exit(1), 500)
      return new Response(
        `<h2>Authorization denied: ${err}</h2><p>You can close this tab.</p>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code) {
      return new Response('Waiting...', { status: 200 })
    }

    // Exchange code for tokens
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await res.json() as any

    if (tokens.error) {
      console.error(`\n❌  Token exchange failed: ${tokens.error} — ${tokens.error_description}`)
      setTimeout(() => process.exit(1), 500)
      return new Response(
        `<h2>Token exchange failed: ${tokens.error}</h2>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const refreshToken = tokens.refresh_token

    console.log('✅  Authorization successful!\n')
    console.log('──────────────────────────────────────────────────────────')
    console.log('  Add these to your .env file:')
    console.log('──────────────────────────────────────────────────────────')
    console.log(`\nGADS_REFRESH_TOKEN=${refreshToken}`)
    console.log(`GSC_REFRESH_TOKEN=${refreshToken}`)
    console.log('\n(Both use the same token — it now covers Ads + Search Console)\n')

    setTimeout(() => { server.stop(); process.exit(0) }, 1000)

    return new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
        <h2>✅ Authorization successful!</h2>
        <p>Your refresh token has been printed in the terminal.</p>
        <p>You can close this tab.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  },
})
