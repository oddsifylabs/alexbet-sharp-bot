# AlexBET Sharp Bot — Complete Guide (v2.0)

## What is AlexBET Sharp Bot?

**@AlexBetSharp_Bot** on Telegram is your real-time sports betting gem finder.

✅ Scans 6 sports × 3 markets (h2h, spreads, totals)  
✅ Shows game times in YOUR timezone  
✅ Displays league icons & team names  
✅ Kelly sizing recommendations  
✅ Real odds data (no mock data)  

**Available sports:** 🏀 NBA, 🏈 NFL, ⚾ MLB, 🏒 NHL, 🎾 Tennis, ⚽ Soccer

---

## Getting Started

### Step 1: Start the Bot

Open Telegram and search for: **@AlexBetSharp_Bot**

Type `/start`

Bot will ask: **"What's your bankroll?"**

Reply with a number, e.g., `5000` (means $5,000)

✅ Bankroll set!

---

### Step 2: Set Your Timezone

The bot shows game times in YOUR timezone (default EST).

To change:

Type `/timezone`

Select your US timezone:
- 🗽 EST (New York)
- ⏰ CST (Chicago)
- 🏔️ MST (Denver)
- 🌲 PST (Los Angeles)
- Alaska or Hawaii

✅ All future game times will show in your local time!

---

## Main Commands

### `/scan` — Find Gems

Scans all games and returns the top 5 gems (highest edge).

**What you get:**

```
Gem 1 ⚡ +6.5%

🏀 *NBA* | Spread
*Heat* @ -110
Miami vs Boston

📅 04/15/26 at 7:30 PM EST
📍 DraftKings

💰 *Bet Sizing Options:*
🎯 Kelly (50%): $185
🟢 Conservative (2%): $100
🟡 Conservative (1.5%): $75
🔴 Conservative (1%): $50

💰 Bankroll: $5000
```

**What it shows:**
- **Gem #** — Ranking by edge
- **Edge %** — Estimated profit advantage
- **League icon + sport** — 🏀 NBA, 🏈 NFL, etc
- **Market type** — ML (Moneyline), Spread, or Total
- **Pick** — Team/player to bet on
- **Odds** — Your entry odds
- **Teams** — Full matchup
- **Date & time** — In YOUR timezone
- **Sportsbook** — Where these odds are
- **Bet sizing options** — Kelly or conservative sizing

---

### `/stats` — Your Performance

Shows your current stats (live dashboard):
- P&L (profit/loss)
- Win rate %
- Number of bets placed

**Pro tip:** For detailed analytics (CLV, ROI, avg edge), use **ALexBET Lite**: https://alexbetlite.netlify.app

---

### `/timezone` — Change Timezone

Select from 6 US timezones:

All game times in `/scan` results will match your timezone.

**Examples:**
- Select PST → Heat vs Celtics at 7:30 PM ET shows as 4:30 PM PT
- Select CST → Same game shows as 5:30 PM CT

---

### `/subscribe` — Upgrade to Paid

**Current plan:** Free tier (5 gems/day)

**Coming soon:**
- 🟢 Sharp $49/mo — Unlimited gems + player props
- 🟡 Elite $99/mo — Team props + Ask Alex (AI coach)

---

### `/lite` — Quick Link to Tracker

Sends a link to **ALexBET Lite**: https://alexbetlite.netlify.app

Use this to log bets, track CLV, and validate your edge.

---

### `/help` — Show All Commands

Displays this menu.

---

## How to Use (Full Workflow)

### 1. Run `/scan`

Bot returns 5 gems like:
```
Gem 1 ⚡ +6.5%
🏀 *NBA* | Spread
*Heat* @ -110
...
```

### 2. Pick a Gem

Example: You like **Gem 1 (Heat Spread at -110)**

### 3. Place the Bet

Go to your sportsbook (DraftKings, FanDuel, BetMGM, etc)

Place the exact bet: **Heat -3.5 @ -110**

Note the odds you get: **-110**

### 4. Log It in ALexBET Lite

Go to: https://alexbetlite.netlify.app

Click "Add Bet" and fill in:
- **Pick:** Miami Heat
- **Entry Odds:** -110 (from your sportsbook)
- **Edge %:** 6.5 (from the bot)
- **Stake:** $50 (your choice)
- **Bet Type:** Spread
- **Sport:** NBA

Click "➕ Add Bet"

✅ Bet logged!

### 5. When Game Starts

Go to your sportsbook at kickoff

Check what the line is (e.g., -115)

Go back to ALexBET Lite

Click "Set: [odds]" and enter -115

✨ CLV% auto-calculates!

### 6. After Game

Mark bet as WON or LOST

P&L auto-calculates

Check your analytics

### 7. Repeat

Run `/scan` again when ready for next bet

Repeat 30+ times to validate your edge

---

## Understanding the Gem Display

### Example Gem:

```
Gem 1 ⚡ +6.5%

🏀 *NBA* | Spread
*Heat* @ -110
Miami vs Boston

📅 04/15/26 at 7:30 PM EST
📍 DraftKings

💰 *Bet Sizing Options:*
🎯 Kelly (50%): $185
🟢 Conservative (2%): $100
🟡 Conservative (1.5%): $75
🔴 Conservative (1%): $50

💰 Bankroll: $5000
```

**Breaking it down:**

| Part | Meaning |
|------|---------|
| **Gem 1** | This is the #1 ranked gem (highest edge) |
| **⚡ +6.5%** | 6.5% estimated edge on this bet |
| **🏀 NBA** | Basketball (NBA league) |
| **Spread** | Bet type (pick winner with point spread) |
| **Heat** | The pick (team to bet on) |
| **@-110** | Current odds available |
| **Miami vs Boston** | Full matchup |
| **04/15/26 at 7:30 PM EST** | Game date & time in your timezone |
| **DraftKings** | Where these odds are found |
| **Bet sizing** | How much to wager based on bankroll |
| **Kelly (50%)** | Aggressive sizing (50% of Kelly formula) |
| **Conservative 1-2%** | Safe sizing (1-2% of bankroll) |

---

## Markets Explained

The bot scans 3 market types:

### 1. **ML (Moneyline)** — Pick the Winner

Straight up, no points involved.

**Example:** 
- Bet: Heat ML
- Odds: -110 (Heat is favored)
- If Heat wins by any amount = you win

---

### 2. **Spread** — Pick Winner + Margin

Pick winner AND cover the point spread.

**Example:**
- Bet: Heat -3.5 at -110
- Heat must win by 4+ points
- If Heat wins by 3 = you lose

---

### 3. **Total** — Pick Over/Under

Pick if combined score goes over or under a number.

**Example:**
- Bet: Over 210.5 at -110
- Final score is 115-98 (213 total)
- If score > 210.5 = you win

---

## Tips for Success

### 1. Bet EARLY

Book your edge early in the week  
If you wait, odds move against you  
Target: Wednesday-Thursday for weekend games

### 2. Line Shop

Use the bot to find good lines  
But compare multiple sportsbooks  
Example: Heat -110 on DraftKings vs -105 on FanDuel  
Bet the -105 (better odds)

### 3. Set Timezone Correctly

Bot shows times in your timezone  
Wrong timezone = missed games  
Run `/timezone` to double-check

### 4. Log ALL Bets

Not just winners  
Every bet gets logged  
This is the ONLY way to measure your real edge

### 5. Update Closing Odds in Lite

When game starts, update closing odds in ALexBET Lite  
This calculates CLV (closing line value)  
CLV > Win rate for profitability proof

### 6. Don't Bet Every Gem

Be selective!  
Start with Gem #1 and #2 only  
Quality over quantity

### 7. Use Conservative Sizing

Start with 1-2% bet sizing  
Not Kelly (too aggressive for testing)  
Example: $5,000 bankroll = $50-100 per bet max

---

## Markets Available (6 Sports)

| Sport | Emoji | Available Markets |
|-------|-------|------------------|
| NBA Basketball | 🏀 | ML, Spread, Total |
| NFL Football | 🏈 | ML, Spread, Total |
| MLB Baseball | ⚾ | ML, Spread, Total |
| NHL Hockey | 🏒 | ML, Spread, Total |
| ATP Tennis | 🎾 | ML, Spread, Total |
| EPL Soccer | ⚽ | ML, Spread, Total |

---

## Common Questions

### Q: What does "edge" mean?

**A:** Expected profit advantage on a bet.
- 6.5% edge = 6.5% profit over long run if repeated
- Our algorithm estimates this

### Q: Why do gems change each scan?

**A:** Different games are available at different times.
- Morning: Might have baseball gems
- Evening: Football/basketball gems
- Scan multiple times per day for variety

### Q: Can I bet more than the suggested size?

**A:** Yes, but not recommended.
- If you want to, never exceed 1% of bankroll
- Example: $5,000 bankroll = max $50 per bet
- Protects you if algorithm is wrong

### Q: What if my sportsbook doesn't have this exact line?

**A:** Line shop!
- Use bot to identify the gem
- Check your sportsbook
- If line is different, enter actual odds in Lite

### Q: Why are some odds positive (+150) and some negative (-110)?

**A:**
- **Negative odds (-110):** Favorite (higher chance of winning)
- **Positive odds (+150):** Underdog (lower chance of winning)
- Both can have edge if priced wrong by market

### Q: How often should I scan?

**A:** As often as you want to bet.
- Scan 1x/day to find daily gems
- Scan 3-4x/day to find multiple opportunities
- No rate limit!

### Q: Does the bot work outside USA?

**A:** Bot is designed for USA sports & USA timezones.
- Odds are USA sportsbooks only
- Times are USA timezones only
- Bet on USA sports from anywhere

### Q: Can I trust the "edge" percentage?

**A:** It's an estimate.
- Validate with real results
- Log 30+ bets and check win rate + CLV
- If win rate is high + CLV is positive = our algorithm works
- If not = adjust your settings

---

## Setting Bankroll

**At start:** Bot asks "What's your bankroll?"

**Why it matters:**
- Determines bet sizing recommendations
- Protects you from over-wagering
- Example: $5,000 bankroll = $50 recommended max per bet

**To change bankroll:** 
- Type `/start` again
- Enter new amount

---

## Real Data Only

⚠️ **Important:** AlexBET Sharp Bot uses REAL odds from Odds API.

**No mock data.** No simulation.

If no games are scheduled:
```
⏳ No live games scheduled right now.
Try again in a few hours.
```

This is a FEATURE, not a bug. We only show real opportunities.

---

## Next Steps

1. ✅ Open Telegram: @AlexBetSharp_Bot
2. ✅ Type `/start` (set bankroll)
3. ✅ Type `/timezone` (set your timezone)
4. ✅ Type `/scan` (find gems)
5. ✅ Pick ONE gem
6. ✅ Place bet on your sportsbook
7. ✅ Go to https://alexbetlite.netlify.app
8. ✅ Log the bet
9. ✅ When game starts: update closing odds in Lite
10. ✅ After game: mark as WON/LOST
11. ✅ Repeat for 30+ bets
12. ✅ When metrics hit (56%+ win rate, positive CLV) → Ready to launch!

---

**Remember:** You're validating your edge, not making millions overnight.

Track honestly. Let the data speak.

🚀 Let's go!
