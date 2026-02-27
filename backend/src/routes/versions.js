const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// GET /api/versions/:policyId - Get all versions
router.get('/:policyId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM policy_versions WHERE policy_id = $1 ORDER BY created_at DESC',
      [req.params.policyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching versions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/versions/:policyId/snapshot - Create version snapshot
router.post('/:policyId/snapshot', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { policyId } = req.params;
    const { PolicyRules, PolicyScoring, PolicyDecisionTree, PolicyClauses } = require('../models/PolicyModels');

    // Get current policy data
    const policy = await pool.query('SELECT * FROM policies WHERE id = $1', [policyId]);
    if (policy.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const tags = await pool.query('SELECT tag_name FROM policy_tags WHERE policy_id = $1', [policyId]);
    const rules = await PolicyRules.findOne({ policyId });
    const scoring = await PolicyScoring.findOne({ policyId });
    const tree = await PolicyDecisionTree.findOne({ policyId });
    const clauses = await PolicyClauses.findOne({ policyId });

    const snapshot = {
      policy: policy.rows[0],
      tags: tags.rows.map(t => t.tag_name),
      rules: rules ? rules.ruleJson : null,
      scoring: scoring ? scoring.scoringJson : null,
      decisionTree: tree ? tree.decisionTreeJson : null,
      clauses: clauses ? clauses.clauses : null
    };

    const id = uuidv4();
    await pool.query(
      `INSERT INTO policy_versions (id, policy_id, version_number, json_snapshot, status, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, policyId, policy.rows[0].version, JSON.stringify(snapshot), policy.rows[0].status, req.body.userId || 'system']
    );

    res.json({ id, versionNumber: policy.rows[0].version, snapshot });
  } catch (err) {
    console.error('Error creating snapshot:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/versions/:policyId/compare - Compare two versions
router.get('/:policyId/compare', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { base, compare } = req.query;

    const baseVersion = await pool.query('SELECT * FROM policy_versions WHERE id = $1', [base]);
    const compareVersion = await pool.query('SELECT * FROM policy_versions WHERE id = $1', [compare]);

    if (baseVersion.rows.length === 0 || compareVersion.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const baseSnapshot = baseVersion.rows[0].json_snapshot;
    const compareSnapshot = compareVersion.rows[0].json_snapshot;

    // Compute diff
    const diff = computeDiff(
      typeof baseSnapshot === 'string' ? JSON.parse(baseSnapshot) : baseSnapshot,
      typeof compareSnapshot === 'string' ? JSON.parse(compareSnapshot) : compareSnapshot
    );

    res.json({
      base: baseVersion.rows[0],
      compare: compareVersion.rows[0],
      diff
    });
  } catch (err) {
    console.error('Error comparing versions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple JSON diff
function computeDiff(base, compare, path = '') {
  const changes = [];

  const allKeys = new Set([...Object.keys(base || {}), ...Object.keys(compare || {})]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const baseVal = base ? base[key] : undefined;
    const compareVal = compare ? compare[key] : undefined;

    if (baseVal === undefined) {
      changes.push({ type: 'added', path: currentPath, newValue: compareVal });
    } else if (compareVal === undefined) {
      changes.push({ type: 'removed', path: currentPath, oldValue: baseVal });
    } else if (typeof baseVal === 'object' && typeof compareVal === 'object' && !Array.isArray(baseVal)) {
      changes.push(...computeDiff(baseVal, compareVal, currentPath));
    } else if (JSON.stringify(baseVal) !== JSON.stringify(compareVal)) {
      changes.push({ type: 'modified', path: currentPath, oldValue: baseVal, newValue: compareVal });
    }
  }

  return changes;
}

module.exports = router;
