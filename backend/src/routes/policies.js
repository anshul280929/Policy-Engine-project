const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET /api/policies - List all policies
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { search, status, product, sortBy = 'updated_at', order = 'DESC', page = 1, size = 10 } = req.query;
    
    let query = 'SELECT * FROM policies WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (LOWER(policy_name) LIKE $${paramIndex} OR LOWER(policy_id) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }
    if (status && status !== 'All') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (product && product !== 'All') {
      query += ` AND product = $${paramIndex}`;
      params.push(product);
      paramIndex++;
    }

    query += ` ORDER BY ${sortBy} ${order}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size));

    const result = await pool.query(query, params);
    
    const countResult = await pool.query('SELECT COUNT(*) FROM policies');
    
    res.json({
      policies: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      size: parseInt(size)
    });
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/policies - Create new policy
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const id = uuidv4();
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const policyId = `POL-${year}-${randomDigits}`;
    
    const {
      policyName, policyType, primarySegment,
      effectiveDate, expiryDate, targetTags, description
    } = req.body;

    const result = await pool.query(
      `INSERT INTO policies (id, policy_id, policy_name, policy_type, primary_segment, 
       effective_date, expiry_date, description, status, current_step, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', 1, '1.0', NOW(), NOW())
       RETURNING *`,
      [id, policyId, policyName, policyType, primarySegment, effectiveDate, expiryDate, description]
    );

    // Insert tags
    if (targetTags && targetTags.length > 0) {
      for (const tag of targetTags) {
        await pool.query(
          'INSERT INTO policy_tags (id, policy_id, tag_name) VALUES ($1, $2, $3)',
          [uuidv4(), id, tag]
        );
      }
    }

    res.status(201).json({
      ...result.rows[0],
      policyId,
      status: 'DRAFT',
      currentStep: 2
    });
  } catch (err) {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/policies/:id - Get policy details
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query('SELECT * FROM policies WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const tags = await pool.query('SELECT tag_name FROM policy_tags WHERE policy_id = $1', [req.params.id]);
    
    res.json({
      ...result.rows[0],
      targetTags: tags.rows.map(t => t.tag_name)
    });
  } catch (err) {
    console.error('Error fetching policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/policies/:id - Update policy
router.patch('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const updates = req.body;
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        setClauses.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE policies SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/policies/:id/submit - Submit for review
router.post('/:id/submit', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE policies SET status = 'UNDER_REVIEW', is_submitted = true, updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    // Create audit log entry
    await pool.query(
      `INSERT INTO policy_audit_log (id, policy_id, action, performed_by, comment, timestamp)
       VALUES ($1, $2, 'SUBMITTED', $3, 'Policy submitted for review', NOW())`,
      [uuidv4(), req.params.id, req.body.userId || 'system']
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error submitting policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/policies/:id/approve - Approve policy
router.post('/:id/approve', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { notes, userId } = req.body;

    const result = await pool.query(
      `UPDATE policies SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await pool.query(
      `INSERT INTO policy_audit_log (id, policy_id, action, performed_by, comment, timestamp)
       VALUES ($1, $2, 'APPROVED', $3, $4, NOW())`,
      [uuidv4(), req.params.id, userId || 'system', notes]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error approving policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/policies/:id/reject - Reject policy
router.post('/:id/reject', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { notes, userId } = req.body;

    const result = await pool.query(
      `UPDATE policies SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await pool.query(
      `INSERT INTO policy_audit_log (id, policy_id, action, performed_by, comment, timestamp)
       VALUES ($1, $2, 'REJECTED', $3, $4, NOW())`,
      [uuidv4(), req.params.id, userId || 'system', notes]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rejecting policy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/policies/dashboard/metrics - Dashboard KPIs
router.get('/dashboard/metrics', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const active = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'ACTIVE'");
    const pending = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'UNDER_REVIEW'");
    const drafts = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'DRAFT'");
    
    res.json({
      activePolicies: parseInt(active.rows[0].count),
      pendingApproval: parseInt(pending.rows[0].count),
      draftsInProgress: parseInt(drafts.rows[0].count),
      ruleExecutions: '1.2M'
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
