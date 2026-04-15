/**
 * AlexBET Sharp - REST API Endpoints
 * Exposes betting data and analytics for third-party integrations
 */

const express = require('express');
const router = express.Router();

// Simple API key middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.ALEXBET_API_KEY || 'demo-key-12345';
  
  if (apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }
  next();
};

// Apply auth to all routes
router.use(apiKeyAuth);

/**
 * GET /api/bets
 * Retrieve user's bets with optional filtering
 */
router.get('/bets', (req, res) => {
  const { status, sport, limit = 50 } = req.query;
  
  try {
    // In production, would fetch from Supabase
    const mockBets = [
      {
        id: 1,
        date: '2026-04-15',
        pick: 'HEAT',
        sport: 'NBA',
        entryOdds: -110,
        closingOdds: -115,
        clv: 1.2,
        edge: 4.5,
        stake: 100,
        status: 'WON',
        pnl: 90,
        betType: 'ML'
      },
      {
        id: 2,
        date: '2026-04-15',
        pick: 'CHIEFS -3.5',
        sport: 'NFL',
        entryOdds: -110,
        closingOdds: -105,
        clv: 0.8,
        edge: 3.2,
        stake: 100,
        status: 'PENDING',
        pnl: 0,
        betType: 'SPREAD'
      }
    ];

    // Filter by status
    let results = mockBets;
    if (status) {
      results = results.filter(b => b.status === status.toUpperCase());
    }

    // Filter by sport
    if (sport) {
      results = results.filter(b => b.sport === sport.toUpperCase());
    }

    // Limit results
    results = results.slice(0, parseInt(limit));

    res.json({
      success: true,
      count: results.length,
      bets: results
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bets', details: err.message });
  }
});

/**
 * GET /api/stats
 * Retrieve user's betting statistics
 */
router.get('/stats', (req, res) => {
  try {
    const mockStats = {
      totalBets: 47,
      wins: 26,
      losses: 21,
      winRate: 55.3,
      totalPnl: 1240,
      avgClv: 1.05,
      avgEdge: 3.8,
      bytesSport: {
        NBA: { bets: 18, wins: 10, winRate: 55.6, pnl: 450 },
        NFL: { bets: 15, wins: 9, winRate: 60, pnl: 380 },
        MLB: { bets: 10, wins: 5, winRate: 50, pnl: 220 },
        NHL: { bets: 4, wins: 2, winRate: 50, pnl: 190 }
      },
      byMarket: {
        ML: { bets: 25, wins: 14, winRate: 56, pnl: 680 },
        SPREAD: { bets: 15, wins: 9, winRate: 60, pnl: 420 },
        TOTAL: { bets: 7, wins: 3, winRate: 42.9, pnl: 140 }
      },
      bankroll: 5000,
      maxDrawdown: 8.5,
      streak: {
        current: 5,
        direction: 'wins',
        personal_best: 12
      }
    };

    res.json({
      success: true,
      stats: mockStats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

/**
 * GET /api/picks
 * Retrieve today's recommended gem picks
 */
router.get('/picks', (req, res) => {
  try {
    const mockPicks = [
      {
        id: 1,
        team: 'HEAT',
        sport: 'NBA',
        market: 'ML',
        odds: -110,
        edge: 4.5,
        clvTarget: 1.5,
        confidence: 'High',
        reasoning: 'Strong home court advantage + defensive matchup favorable'
      },
      {
        id: 2,
        team: 'OVER 219.5',
        sport: 'NBA',
        market: 'TOTAL',
        odds: -110,
        edge: 3.2,
        clvTarget: 0.8,
        confidence: 'Medium',
        reasoning: 'Both teams playing up-tempo, injury absence reduces defense'
      },
      {
        id: 3,
        team: 'CHIEFS -3',
        sport: 'NFL',
        market: 'SPREAD',
        odds: -110,
        edge: 5.1,
        clvTarget: 2.2,
        confidence: 'High',
        reasoning: 'Line has moved against the public; sharps backing KC'
      }
    ];

    res.json({
      success: true,
      count: mockPicks.length,
      picks: mockPicks,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch picks', details: err.message });
  }
});

/**
 * POST /api/bets
 * Create a new bet (requires authentication)
 */
router.post('/bets', (req, res) => {
  try {
    const { pick, sport, entryOdds, edge, stake, betType } = req.body;

    if (!pick || !sport || !entryOdds || !edge || !stake) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['pick', 'sport', 'entryOdds', 'edge', 'stake', 'betType']
      });
    }

    // In production, would save to Supabase
    const newBet = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      pick,
      sport,
      entryOdds,
      closingOdds: entryOdds,
      edge,
      stake,
      betType,
      status: 'PENDING',
      clv: 0,
      pnl: 0
    };

    res.status(201).json({
      success: true,
      message: 'Bet created successfully',
      bet: newBet
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bet', details: err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AlexBET Sharp API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
