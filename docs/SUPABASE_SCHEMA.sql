/**
 * Supabase Schema Setup for AlexBET Multi-Tier Model
 * Run these SQL commands in Supabase SQL Editor
 */

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,  -- Telegram user ID
  username VARCHAR(255) UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone_number VARCHAR(20),
  
  -- Preferences
  bankroll INTEGER DEFAULT 100 CHECK (bankroll >= 50 AND bankroll <= 1000000),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  preferred_language VARCHAR(10) DEFAULT 'en',
  
  -- Account Status
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, banned
  verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Audit
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tier Information
  tier_id VARCHAR(50) NOT NULL DEFAULT 'free', -- free, sharp, elite, enterprise
  status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, suspended
  
  -- Payment Information
  payment_provider VARCHAR(50), -- whop, stripe, paypal
  payment_provider_id VARCHAR(255), -- External subscription ID
  
  -- Dates
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  renews_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Trial
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  on_trial BOOLEAN DEFAULT FALSE,
  
  -- Billing
  auto_renew BOOLEAN DEFAULT TRUE,
  billing_cycle VARCHAR(50), -- monthly, annual
  
  -- Custom Data
  team_members JSONB DEFAULT '[]'::jsonb, -- Array of user IDs for team members
  metadata JSONB, -- Custom fields
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier_id ON subscriptions(tier_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- ============================================================================
-- 3. SCANS TABLE (Betting Recommendations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scan Details
  sport VARCHAR(50) NOT NULL, -- nba, nfl, mlb, nhl, atp, epl
  market VARCHAR(50) NOT NULL, -- h2h, spreads, totals
  
  -- Game Information
  game_id VARCHAR(255),
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  commence_time TIMESTAMP WITH TIME ZONE,
  
  -- Pick Details
  pick VARCHAR(255), -- "Lakers ML", "Under 210", etc
  odds DECIMAL(6,2),
  
  -- Analysis
  edge_percent DECIMAL(5,2), -- -15.5 to 50.0
  ev_percent DECIMAL(5,2), -- Expected value
  fair_probability DECIMAL(5,2),
  implied_probability DECIMAL(5,2),
  
  -- Kelly Sizing
  kelly_percent DECIMAL(5,2),
  kelly_stake INTEGER, -- Suggested bet amount
  conservative_stake_2pct INTEGER, -- 2% stake
  
  -- Claude AI Analysis (if available)
  claude_edge_percent DECIMAL(5,2),
  claude_confidence INTEGER, -- 0-100
  claude_model VARCHAR(50),
  claude_analysis TEXT,
  
  -- Bookmaker Info
  best_book VARCHAR(100),
  books_compared INTEGER,
  
  -- User Action
  user_action VARCHAR(50), -- viewed, saved, placed, rejected
  placed_amount INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_edge_range CHECK (edge_percent >= -100 AND edge_percent <= 100)
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_sport ON scans(sport);
CREATE INDEX idx_scans_created_at ON scans(created_at);
CREATE INDEX idx_scans_edge ON scans(edge_percent DESC);

-- ============================================================================
-- 4. USAGE TABLE (Track API/Feature Usage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Usage Tracking
  date DATE NOT NULL,
  scans_used INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  
  -- Tier at time of usage
  tier_id VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

CREATE INDEX idx_usage_user_id ON usage(user_id);
CREATE INDEX idx_usage_date ON usage(date);

-- ============================================================================
-- 5. BETS TABLE (User's Placed Bets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  
  -- Bet Details
  sport VARCHAR(50),
  market VARCHAR(50),
  pick VARCHAR(255),
  odds DECIMAL(6,2),
  amount INTEGER NOT NULL,
  
  -- Outcome
  status VARCHAR(50) DEFAULT 'pending', -- pending, won, lost, cancelled
  result_odds DECIMAL(6,2), -- Actual odds if different
  result_amount INTEGER, -- Winnings
  
  -- Timestamps
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_placed_at ON bets(placed_at);

-- ============================================================================
-- 6. PAYMENTS TABLE (Transaction History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Payment Details
  provider VARCHAR(50), -- whop, stripe, paypal
  provider_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(50), -- completed, failed, pending, refunded
  
  -- Dates
  payment_date TIMESTAMP WITH TIME ZONE,
  refund_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);

-- ============================================================================
-- 7. AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Event Details
  event_type VARCHAR(100), -- login, subscription_change, scan, etc
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  
  -- Changes
  old_value JSONB,
  new_value JSONB,
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- ============================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active Users
CREATE OR REPLACE VIEW active_users AS
SELECT 
  u.id,
  u.username,
  u.bankroll,
  s.tier_id,
  s.status as subscription_status,
  u.last_active,
  u.created_at
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.status = 'active'
  AND (s.status = 'active' OR s.tier_id = 'free');

-- User Stats
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.username,
  s.tier_id,
  COUNT(DISTINCT sc.id) as total_scans,
  COUNT(DISTINCT b.id) as total_bets,
  SUM(CASE WHEN b.status = 'won' THEN 1 ELSE 0 END) as bets_won,
  SUM(CASE WHEN b.status = 'lost' THEN 1 ELSE 0 END) as bets_lost,
  COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.result_amount - b.amount ELSE -(b.amount) END), 0) as net_profit,
  u.created_at
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN scans sc ON u.id = sc.user_id
LEFT JOIN bets b ON u.id = b.user_id
GROUP BY u.id, u.username, s.tier_id;

-- ============================================================================
-- SEED DATA (Optional)
-- ============================================================================

-- Create a test user
INSERT INTO users (id, username, first_name, last_name, bankroll, timezone, verified)
VALUES (999999999, 'testuser', 'Test', 'User', 100, 'America/New_York', TRUE)
ON CONFLICT DO NOTHING;

-- Create free tier subscription for test user
INSERT INTO subscriptions (user_id, tier_id, status)
VALUES (999999999, 'free', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (Optional but recommended)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY users_own_data ON users
  FOR ALL USING (auth.uid()::bigint = id OR auth.role() = 'service_role');

CREATE POLICY subscriptions_own_data ON subscriptions
  FOR ALL USING (auth.uid()::bigint = user_id OR auth.role() = 'service_role');

CREATE POLICY scans_own_data ON scans
  FOR ALL USING (auth.uid()::bigint = user_id OR auth.role() = 'service_role');

CREATE POLICY bets_own_data ON bets
  FOR ALL USING (auth.uid()::bigint = user_id OR auth.role() = 'service_role');

CREATE POLICY payments_own_data ON payments
  FOR ALL USING (auth.uid()::bigint = user_id OR auth.role() = 'service_role');
