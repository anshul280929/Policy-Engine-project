const express = require('express');
const router = express.Router();
const { PolicyRules } = require('../models/PolicyModels');

// GET /api/rules/:policyId - Get eligibility rules
router.get('/:policyId', async (req, res) => {
  try {
    const rules = await PolicyRules.findOne({ policyId: req.params.policyId });
    res.json(rules || { policyId: req.params.policyId, ruleJson: { type: 'group', operator: 'AND', conditions: [] }, generatedSql: '', estimatedApprovalRate: 0 });
  } catch (err) {
    console.error('Error fetching rules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rules/:policyId - Save eligibility rules
router.post('/:policyId', async (req, res) => {
  try {
    const { ruleJson } = req.body;
    const generatedSql = generateSqlFromRuleJson(ruleJson);
    
    const rules = await PolicyRules.findOneAndUpdate(
      { policyId: req.params.policyId },
      { policyId: req.params.policyId, ruleJson, generatedSql, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(rules);
  } catch (err) {
    console.error('Error saving rules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rules/generate-sql - Generate SQL from rule JSON
router.post('/generate-sql', async (req, res) => {
  try {
    const { ruleJson } = req.body;
    const sql = generateSqlFromRuleJson(ruleJson);
    res.json({ sql });
  } catch (err) {
    console.error('Error generating SQL:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: Convert rule JSON tree to SQL WHERE clause
function generateSqlFromRuleJson(node) {
  if (!node) return '';

  if (node.type === 'group') {
    if (!node.conditions || node.conditions.length === 0) return '';
    const parts = node.conditions
      .map(c => generateSqlFromRuleJson(c))
      .filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `(${parts.join(` ${node.operator} `)})`;
  }

  // Single condition
  const { field, operator, value } = node;
  if (!field || !operator) return '';

  if (Array.isArray(value)) {
    const formatted = value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
    return `${field} ${operator} (${formatted})`;
  }

  const formattedValue = typeof value === 'string' ? `'${value}'` : value;
  return `${field} ${operator} ${formattedValue}`;
}

module.exports = router;
