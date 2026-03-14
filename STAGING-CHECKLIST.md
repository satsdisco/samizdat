# 🧪 STAGING TESTING CHECKLIST

Before promoting to production, verify ALL items work on staging.

## 🔐 Authentication Tests
- [ ] **Login with extension** (Alby/nos2x)
- [ ] **Login with nsec** 
- [ ] **Login with NIP-46 bunker**
- [ ] **QR code login flow**
- [ ] **Logout and re-login**

## ✍️ Publishing Tests  
- [ ] **Create new article** (basic content)
- [ ] **Add zap gate** (test amount: 21 sats)
- [ ] **Set preview cutoff** (reasonable length)
- [ ] **Add banner image**
- [ ] **Publish successfully** 
- [ ] **Check preview on public relays** (nos.lol, damus)
- [ ] **Verify full article on private relay**

## 📖 Reading Tests
- [ ] **View article preview** (paywall visible)
- [ ] **Zap gate shows correct amount**
- [ ] **Zap button works** (opens wallet)
- [ ] **Manual unlock works** ("I've zapped" button)
- [ ] **Full article displays** (content longer than preview)
- [ ] **Comments load and display**
- [ ] **Share button works**

## 📱 Mobile Tests (resize browser)
- [ ] **Reading experience** (typography, spacing)
- [ ] **Zap gate on mobile** (buttons accessible)
- [ ] **Editor on mobile** (toolbar, typing)
- [ ] **Navigation works** (back/forward)

## 🔗 Technical Tests
- [ ] **No console errors** 
- [ ] **Fast loading** (<3 seconds)
- [ ] **Relay connections** (green in dev tools)
- [ ] **Images load properly**
- [ ] **Links work** (internal + external)

## 🚨 Edge Cases
- [ ] **Offline/network errors** (graceful fallback)
- [ ] **Very long articles** (performance OK)
- [ ] **Special characters** (emojis, unicode)
- [ ] **Empty states** (no articles, no comments)

---

## ✅ PROMOTION CRITERIA

**ALL boxes must be checked before promoting to production.**

If any test fails:
1. Fix the issue on staging
2. Re-test the entire checklist  
3. Only then promote to production

**Staging URL:** https://samizdat-staging.vercel.app  
**Production URL:** https://samizdat.press

---

## 📋 Testing Commands

```bash
# Deploy to staging
./scripts/deploy-staging.sh

# Test everything on staging URL

# Promote to production (only if all tests pass)
./scripts/promote-staging.sh
```