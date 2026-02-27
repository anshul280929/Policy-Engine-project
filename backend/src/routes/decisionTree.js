const express = require('express');
const router = express.Router();
const { PolicyDecisionTree } = require('../models/PolicyModels');

// GET /api/decision-tree/:policyId
router.get('/:policyId', async (req, res) => {
  try {
    const tree = await PolicyDecisionTree.findOne({ policyId: req.params.policyId });
    res.json(tree || {
      policyId: req.params.policyId, 
      decisionTreeJson: {},
      isValidated: false
    });
  } catch (err) {
    console.error('Error fetching decision tree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/decision-tree/:policyId
router.post('/:policyId', async (req, res) => {
  try {
    const { decisionTreeJson } = req.body;
    const tree = await PolicyDecisionTree.findOneAndUpdate(
      { policyId: req.params.policyId },
      { policyId: req.params.policyId, decisionTreeJson, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(tree);
  } catch (err) {
    console.error('Error saving decision tree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/decision-tree/:policyId/test - Test decision tree with sample data
router.post('/:policyId/test', async (req, res) => {
  try {
    const tree = await PolicyDecisionTree.findOne({ policyId: req.params.policyId });
    if (!tree || !tree.decisionTreeJson) {
      return res.status(400).json({ error: 'No decision tree configured' });
    }

    const applicantData = req.body;
    const result = evaluateDecisionTree(tree.decisionTreeJson, applicantData);

    // Update last tested
    await PolicyDecisionTree.findOneAndUpdate(
      { policyId: req.params.policyId },
      { isValidated: true, lastTestedAt: new Date() }
    );

    res.json(result);
  } catch (err) {
    console.error('Error testing decision tree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recursive decision tree evaluator
function evaluateDecisionTree(node, data) {
  const trace = [];

  function evaluate(n) {
    if (!n || !n.type) {
      if (n && n.action) return { action: n.action, tier: n.tier };
      return { action: 'NO_DECISION' };
    }

    if (n.type === 'condition') {
      let conditionMet = false;

      if (n.if.operator && n.if.conditions) {
        // Group condition (AND/OR)
        const results = n.if.conditions.map(c => evaluateSingleCondition(c, data));
        if (n.if.operator === 'AND') {
          conditionMet = results.every(r => r.met);
        } else {
          conditionMet = results.some(r => r.met);
        }
        results.forEach(r => trace.push(r.trace));
      } else {
        // Single condition
        const result = evaluateSingleCondition(n.if, data);
        conditionMet = result.met;
        trace.push(result.trace);
      }

      if (conditionMet) {
        const thenResult = n.then;
        if (thenResult.type === 'condition') return evaluate(thenResult);
        return { action: thenResult.action, tier: thenResult.tier };
      } else {
        const elseResult = n.else;
        if (!elseResult) return { action: 'NO_DECISION' };
        if (elseResult.type === 'condition') return evaluate(elseResult);
        return { action: elseResult.action, tier: elseResult.tier };
      }
    }

    return { action: 'NO_DECISION' };
  }

  function evaluateSingleCondition(condition, data) {
    const { field, operator, value } = condition;
    const actual = data[field];
    let met = false;

    switch (operator) {
      case '>': met = actual > value; break;
      case '>=': met = actual >= value; break;
      case '<': met = actual < value; break;
      case '<=': met = actual <= value; break;
      case '=': case '==': met = actual == value; break;
      case '!=': met = actual != value; break;
      case 'IN': met = Array.isArray(value) && value.includes(actual); break;
      case 'NOT IN': met = Array.isArray(value) && !value.includes(actual); break;
      default: met = false;
    }

    return {
      met,
      trace: `${field} ${operator} ${JSON.stringify(value)} ${met ? '✓' : '✗'}`
    };
  }

  const result = evaluate(node);
  return {
    decision: result.action,
    tier: result.tier || null,
    trace,
    path: trace
  };
}

module.exports = router;
