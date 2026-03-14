# Custom Domain Setup Guide for Dominos PR on Railway

This guide walks you through configuring a custom domain (e.g., `dominospr.com` or `play.dominospr.com`) for your Railway-hosted Dominos PR app.

> **Note:** This is optional. The Railway-provided `*.up.railway.app` URL works permanently and already has HTTPS. Only follow this guide when you have a domain ready.

## Prerequisites

- App already deployed on Railway with a working `*.up.railway.app` URL
- A domain you own (purchased from Namecheap, Google Domains, Cloudflare, etc.)
- Access to your domain's DNS settings

## Step 1: Add Custom Domain in Railway

1. Open the [Railway Dashboard](https://railway.com/dashboard)
2. Select your **dominos-pr** project
3. Click on your service (the main deployment)
4. Go to **Settings** -> **Networking** -> **Domains**
5. Click **Add Custom Domain**
6. Enter your desired domain:
   - For a subdomain: `play.dominospr.com`
   - For a root domain: `dominospr.com`
7. Railway will display a **CNAME target** (e.g., `something.up.railway.app`) -- copy this value

## Step 2: Configure DNS at Your Provider

Go to your domain registrar or DNS provider and create a CNAME record.

### For a Subdomain (recommended, e.g., `play.dominospr.com`)

| Record Type | Name   | Value (Target)              | TTL  |
|-------------|--------|-----------------------------|------|
| CNAME       | `play` | `<Railway CNAME target>`    | Auto |

### For a Root Domain (e.g., `dominospr.com`)

Root domain CNAME support varies by provider:

- **Cloudflare:** Supports CNAME flattening at the root. Create a CNAME record with Name = `@` and Value = the Railway CNAME target.
- **Namecheap:** Use an ALIAS record (under Advanced DNS) with Host = `@` and Value = the Railway CNAME target.
- **Google Domains:** Supports CNAME at root via synthetic records. Add a CNAME with Host = `@`.
- **Other providers:** If your provider does not support CNAME/ALIAS at the root, use a subdomain instead (e.g., `www` or `play`), then set up a redirect from the root to the subdomain.

### Provider-Specific Examples

**Cloudflare:**
1. Go to your domain -> DNS -> Records
2. Click "Add Record"
3. Type: CNAME, Name: `play` (or `@` for root), Target: `<Railway CNAME target>`
4. Proxy status: **DNS only** (gray cloud) -- do NOT proxy through Cloudflare, as Railway handles SSL
5. Save

**Namecheap:**
1. Go to Domain List -> Manage -> Advanced DNS
2. Click "Add New Record"
3. Type: CNAME, Host: `play` (or use ALIAS for `@`), Value: `<Railway CNAME target>`
4. Save

## Step 3: Wait for DNS Verification

- Railway will automatically check for DNS propagation
- Typically verifies within **5 minutes**
- Can take up to **72 hours** in rare cases (depends on DNS provider TTL)
- You can monitor the status in Railway Dashboard -> Settings -> Domains

## Step 4: SSL Certificate (Automatic)

- Railway automatically provisions a free SSL certificate via **Let's Encrypt**
- No action required on your part
- SSL is typically ready within **5-10 minutes** after DNS verification
- Your custom domain will serve over HTTPS automatically

## Step 5: Verify

1. Open your custom domain in a browser (e.g., `https://play.dominospr.com`)
2. You should see the Dominos PR landing page
3. Check that the padlock icon shows a valid SSL certificate
4. Create a room and verify WebSocket connection works (DevTools -> Network -> WS tab)

## Troubleshooting

### DNS Not Propagated Yet

Check current DNS records with:

```bash
dig CNAME play.dominospr.com
# or for root domain:
dig CNAME dominospr.com
```

If no CNAME appears, your DNS changes have not propagated yet. Wait and try again in 15-30 minutes.

You can also use [dnschecker.org](https://dnschecker.org) to check propagation across global DNS servers.

### SSL Certificate Not Ready

- SSL is provisioned after DNS verification succeeds
- Wait 5-10 minutes after Railway shows "DNS Verified"
- If still no SSL after 30 minutes, try removing and re-adding the domain in Railway

### Redirect Loop or ERR_TOO_MANY_REDIRECTS

- **Cloudflare users:** Make sure proxy is set to "DNS only" (gray cloud), not "Proxied" (orange cloud). Railway handles SSL itself; double-proxying causes redirect loops.
- Check for conflicting A records pointing to a different IP. Remove any A records for the same hostname.
- Ensure you do not have Cloudflare's "Always Use HTTPS" or "Automatic HTTPS Rewrites" enabled for this domain if proxying is on.

### Domain Shows Old/Different Site

- Verify the CNAME target matches what Railway provided
- Clear browser cache or test in incognito/private window
- Check that no other DNS records (A, AAAA) exist for the same hostname that could override the CNAME

### WebSocket Not Connecting on Custom Domain

- WebSocket connections should work identically on custom domains since Railway routes all traffic through the same service
- If using Cloudflare proxy (orange cloud), WebSocket may have issues -- switch to DNS only (gray cloud)
- Verify in browser DevTools -> Network -> WS that the connection upgrades successfully

## Removing a Custom Domain

1. Railway Dashboard -> Service -> Settings -> Domains
2. Click the trash icon next to your custom domain
3. Remove the CNAME record from your DNS provider
4. The `*.up.railway.app` URL continues to work regardless
