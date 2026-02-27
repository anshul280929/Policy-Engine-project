const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET /api/approvals - Approval queue
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { search, reviewer, status, sortBy = 'submitted_at', order = 'DESC', page = 1, size = 10 } = req.query;

    let query = `SELECT p.*, aq.submitted_at, aq.current_level, aq.assigned_to, aq.priority
                 FROM policies p 
                 JOIN approval_queue aq ON p.id = aq.policy_id
                 WHERE p.status = 'UNDER_REVIEW'`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (LOWER(p.policy_name) LIKE $${paramIndex} OR LOWER(p.policy_id) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    query += ` ORDER BY ${sortBy} ${order}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size));

    const result = await pool.query(query, params);
    res.json({ approvals: result.rows });
  } catch (err) {
    console.error('Error fetching approvals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/approvals/dashboard-metrics
router.get('/dashboard-metrics', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const pending = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'UNDER_REVIEW'");
    const approvedToday = await pool.query(
      "SELECT COUNT(*) FROM policy_audit_log WHERE action = 'APPROVED' AND timestamp::date = CURRENT_DATE"
    );
    
    res.json({
      pendingReview: parseInt(pending.rows[0].count),
      urgent: 3,
      approvedToday: parseInt(approvedToday.rows[0].count),
      avgWaitTime: '4h 12m'
    });
  } catch (err) {
    console.error('Error fetching approval metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/approvals/bulk-approve
router.post('/bulk-approve', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { policyIds, userId, notes } = req.body;

    for (const policyId of policyIds) {
      await pool.query(
        `UPDATE policies SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
        [policyId]
      );
      await pool.query(
        `INSERT INTO policy_audit_log (id, policy_id, action, performed_by, comment, timestamp)
         VALUES ($1, $2, 'APPROVED', $3, $4, NOW())`,
        [uuidv4(), policyId, userId || 'system', notes || 'Bulk approved']
      );
    }

    res.json({ approved: policyIds.length });
  } catch (err) {
    console.error('Error bulk approving:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
