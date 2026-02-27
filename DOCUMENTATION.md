# Policy Agent — Credit Policy Management Platform

## Project Documentation

---

## 1. Overview

**Policy Agent** is an enterprise-grade credit policy management platform that enables financial institutions to create, configure, simulate, approve, and publish credit policies through a structured 6-step wizard with a maker-checker governance workflow.

### Key Capabilities

- **6-Step Policy Creation Wizard** — Guided policy configuration from metadata through simulation
- **Rule Builder** — Visual eligibility rule construction with SQL generation
- **Scoring Engine** — Weighted parameter scoring with category management
- **Decision Tree Builder** — Visual conditional logic trees with real-time testing
- **Clause Management** — Template-based clause editor with variable substitution
- **Simulation Engine** — Full pipeline simulation (eligibility → scoring → decision)
- **Version Control** — Snapshot-based versioning with JSON diff comparison
- **Approval Workflow** — Multi-level maker-checker process with audit trail
- **Dashboard** — KPI monitoring, policy lifecycle tracking, and bulk operations

---

## 2. Architecture

```
┌─────────────────────────┐      ┌─────────────────────────┐
│   Frontend (Next.js)    │      │   Backend (Express.js)  │
│   App Router + React 19 │◄────►│   REST API              │
│   CSS Modules           │      │                         │
│   Port: 3000            │      │   Port: 5000            │
└─────────────────────────┘      └──────────┬──────────────┘
                                            │
                              ┌─────────────┴──────────────┐
                              │                            │
                     ┌────────▼────────┐        ┌──────────▼────────┐
                     │  PostgreSQL     │        │  MongoDB           │
                     │  (Neon)         │        │  (Mongoose)        │
                     │                 │        │                    │
                     │  • policies     │        │  • PolicyRules     │
                     │  • policy_tags  │        │  • PolicyScoring   │
                     │  • audit_log    │        │  • PolicyDecisionTree│
                     │  • approval_queue│       │  • PolicyClauses   │
                     │  • versions     │        │  • SimulationResult│
                     └─────────────────┘        └────────────────────┘
```

### Dual-Database Design

| Database   | Purpose                                  | Data Types                             |
|------------|------------------------------------------|----------------------------------------|
| PostgreSQL | Structured metadata, governance, audit   | Policies, tags, approvals, versions    |
| MongoDB    | Deeply nested JSON documents             | Rules, scoring, decision trees, clauses|

**Rationale**: Credit policy rules, scoring parameters, and decision trees are deeply nested JSON structures that change shape frequently — MongoDB handles this naturally. Policy metadata, approval workflows, and audit logs require relational integrity — PostgreSQL handles this reliably.

---

## 3. Tech Stack

### Frontend
| Technology       | Version | Purpose                    |
|------------------|---------|----------------------------|
| Next.js          | 16.1.6  | React framework (App Router)|
| React            | 19.2.3  | UI library                 |
| TypeScript       | 5.x     | Type safety                |
| Axios            | 1.x     | HTTP client                |
| Lucide React     | latest  | Icon library               |
| CSS Modules      | native  | Scoped styling             |

### Backend
| Technology       | Version | Purpose                    |
|------------------|---------|----------------------------|
| Express          | 5.2.1   | HTTP server framework      |
| pg               | 8.19.0  | PostgreSQL client          |
| Mongoose         | 9.2.3   | MongoDB ODM                |
| bcryptjs         | 2.x     | Password hashing           |
| jsonwebtoken     | 9.x     | JWT authentication         |
| uuid             | 11.x    | ID generation              |
| cors             | 2.x     | Cross-origin support       |
| dotenv           | 16.x    | Environment variables      |

---

## 4. Project Structure

```
Policy-agent/
├── backend/
│   ├── server.js                      # Express entry point
│   ├── package.json
│   └── src/
│       ├── db/
│       │   ├── schema.sql             # PostgreSQL schema
│       │   └── migrate.js             # Migration runner
│       ├── models/
│       │   └── PolicyModels.js        # Mongoose models (5 schemas)
│       └── routes/
│           ├── policies.js            # Policy CRUD + status
│           ├── approvals.js           # Approval queue + bulk ops
│           ├── rules.js               # Eligibility rules + SQL gen
│           ├── scoring.js             # Scoring parameters + validation
│           ├── decisionTree.js        # Decision tree + evaluator
│           ├── clauses.js             # Clauses + variable preview
│           ├── simulation.js          # Full simulation engine
│           └── versions.js            # Versioning + diff comparison
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   └── src/
│       ├── lib/
│       │   ├── types.ts              # All TypeScript interfaces
│       │   └── api.ts                # Axios API client
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx        # Navigation sidebar
│       │   │   └── Header.tsx         # Page header + search
│       │   └── policy/
│       │       ├── StepIndicator.tsx   # Wizard progress bar
│       │       ├── Step1Attributes.tsx # Policy metadata
│       │       ├── Step2Eligibility.tsx# Rule builder
│       │       ├── Step3Scoring.tsx    # Scoring parameters
│       │       ├── Step4DecisionTree.tsx# Decision tree builder
│       │       ├── Step5Clauses.tsx    # Clause editor
│       │       ├── Step6Review.tsx     # Review & simulate
│       │       └── Steps.module.css   # Shared wizard styles
│       └── app/
│           ├── globals.css            # Design system variables
│           ├── layout.tsx             # Root layout
│           ├── page.tsx               # Root redirect
│           └── (app)/
│               ├── layout.tsx         # Sidebar layout
│               ├── dashboard/
│               │   └── page.tsx       # Dashboard
│               ├── policy/
│               │   └── create/
│               │       └── page.tsx   # Policy creation wizard
│               └── approvals/
│                   ├── page.tsx        # Approval management
│                   └── [id]/
│                       └── page.tsx   # Approval workspace
│
└── screenshots/                       # Reference screenshots
```

---

## 5. Workflow — Policy Lifecycle

The complete lifecycle of a credit policy follows this flow:

```
 ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
 │  DRAFT   │───►│  IN REVIEW   │───►│   APPROVED   │───►│  ACTIVE  │
 │          │    │              │    │              │    │          │
 └──────────┘    └──────┬───────┘    └──────────────┘    └──────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │   REJECTED   │──── (edit & resubmit) ───►  DRAFT
                 └──────────────┘
```

### 5.1 Step 1 — Policy Attributes

**Route**: `/policy/create` (Step 1)  
**Purpose**: Define the policy identity and metadata.

| Field              | Description                                |
|--------------------|--------------------------------------------|
| Policy Name        | Human-readable policy name                 |
| Policy ID          | Auto-generated unique identifier           |
| Policy Type        | Credit Risk / Underwriting / Collections   |
| Customer Segment   | Retail / SME / Corporate / Microfinance    |
| Effective Date     | When the policy becomes active             |
| Expiry Date        | When the policy expires                    |
| Target Customer Tags| Multi-select: Salaried, Self-employed, etc.|
| Description        | Free-text policy description               |

**Backend**: `POST /api/policies` creates a new policy in PostgreSQL with status `DRAFT`.

---

### 5.2 Step 2 — Eligibility Rules

**Route**: `/policy/create` (Step 2)  
**Purpose**: Define who qualifies for this policy using visual AND/OR rule groups.

**Features**:
- Visual rule builder with AND/OR group toggle
- Dynamic condition rows: Field → Operator → Value
- Auto-generated SQL WHERE clause preview
- Human-readable rule summary
- Estimated approval rate (demo)

**Data Model** (MongoDB `PolicyRules`):
```json
{
  "ruleJson": {
    "operator": "AND",
    "conditions": [
      { "field": "credit_score", "operator": ">=", "value": "650" },
      { "field": "age", "operator": ">=", "value": "21" }
    ]
  }
}
```

**Backend**: 
- `POST /api/rules/:policyId` — Save rules
- `POST /api/rules/generate-sql` — Convert JSON rules to SQL WHERE clause

---

### 5.3 Step 3 — Scoring Parameters

**Route**: `/policy/create` (Step 3)  
**Purpose**: Configure weighted scoring categories and parameters.

**Features**:
- Category-based organization (e.g., Credit Bureau, Affordability)
- Per-parameter: field, operator, threshold, weight
- Real-time weight validation (total must equal 100%)
- Visual weight distribution bar

**Validation Rules**:
- All parameter weights within a category must sum correctly
- Overall category weights must total 100%
- Minimum 1 parameter per category

**Backend**:
- `POST /api/scoring/:policyId` — Save scoring config
- `POST /api/scoring/:policyId/validate` — Validate weights

---

### 5.4 Step 4 — Decision Tree

**Route**: `/policy/create` (Step 4)  
**Purpose**: Build conditional decision logic as a visual tree.

**Features**:
- Recursive tree builder: IF condition → THEN/ELSE branches
- Action nodes: APPROVE, REJECT, REVIEW, REFER (with tier and limit)
- Condition nodes: nested IF groups with AND/OR logic
- **Test Panel**: Enter sample applicant data and evaluate in real-time
- Shows complete execution trace through the tree

**Decision Tree Evaluation Algorithm**:
```
evaluateDecisionTree(node, applicant):
  if node.type == "action":
    return { decision: node.action, tier: node.tier }
  
  if node.type == "condition":
    result = evaluateCondition(node.condition, applicant)
    if result:
      return evaluateDecisionTree(node.then, applicant)
    else:
      return evaluateDecisionTree(node.else, applicant)
```

**Backend**:
- `POST /api/decision-tree/:policyId` — Save tree
- `POST /api/decision-tree/:policyId/test` — Evaluate tree with test data

---

### 5.5 Step 5 — Clauses & Documentation

**Route**: `/policy/create` (Step 5)  
**Purpose**: Draft policy clauses with variable substitution and document requirements.

**Features**:
- Split-panel editor: clause list (left) + editor (right)
- Trigger-based clauses (ALWAYS, IF_CONDITION, SCORE_BASED)
- Template variables: `{Variable}` syntax with preview
- Document checklist with required/optional/conditional status
- AI-suggested documents based on policy type
- Borrower-facing preview with resolved variables

**Backend**:
- `POST /api/clauses/:policyId` — Save all clauses
- `POST /api/clauses/:policyId/preview` — Resolve variables and preview

---

### 5.6 Step 6 — Review & Simulate

**Route**: `/policy/create` (Step 6)  
**Purpose**: Review all configuration, validate, simulate, and submit.

**Features**:
- Rule summary cards organized by category
- Comprehensive validation checklist (all steps, dates, weights)
- **Full Simulation Engine**: Enter applicant data → runs eligibility → scoring → decision tree
- Execution trace showing each evaluation step
- "Submit for Review" button transitions policy to `IN_REVIEW` status

**Simulation Pipeline**:
```
1. ELIGIBILITY CHECK
   └─ Evaluate all rule conditions against applicant
   └─ Result: PASS or FAIL (with specific failures)

2. SCORING
   └─ Evaluate each scoring parameter
   └─ Apply weights → calculate weighted score (0–100)

3. DECISION TREE
   └─ Traverse tree with applicant data + score
   └─ Result: APPROVE / REJECT / REVIEW / REFER + tier

4. FINAL OUTPUT
   └─ { eligible, score, decision, tier, executionTrace[] }
```

**Backend**:
- `POST /api/simulation/:policyId/simulate-full` — Run full pipeline
- `POST /api/simulation/:policyId/validate` — Validate all steps
- `GET /api/simulation/:policyId/history` — Past simulation results

---

## 6. Approval Workflow

### 6.1 Approval Management Dashboard

**Route**: `/approvals`

Displays the queue of policies awaiting review with:
- **KPIs**: Pending Review, Urgent Attention, Approved Today, Avg Wait Time
- **Filterable table**: Policy name, version, submitter, approval level, time in queue
- **Bulk approve** for batch operations
- **SLA urgency highlighting** (>24h in queue turns red)

### 6.2 Approval Workspace

**Route**: `/approvals/[id]`

Four-tab review interface:

| Tab         | Contents                                                    |
|-------------|-------------------------------------------------------------|
| **Changes** | Version diff with color-coded additions/removals/changes    |
| **Impact**  | Portfolio coverage, risk exposure, revenue impact analysis   |
| **Compliance** | Regulatory checklist (Fair Lending, AML, GDPR, etc.)     |
| **Audit**   | Timeline of all approval actions with notes                 |

**Governance Requirements**:
- Approval notes are **mandatory**
- All compliance checks must be completed before approval
- Three approval levels: Risk Review → Compliance → Legal

---

## 7. API Reference

### Policies
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/policies`                   | List all policies        |
| POST   | `/api/policies`                   | Create new policy        |
| GET    | `/api/policies/:id`               | Get policy by ID         |
| PUT    | `/api/policies/:id`               | Update policy            |
| DELETE | `/api/policies/:id`               | Delete policy            |
| POST   | `/api/policies/:id/submit`        | Submit for review        |
| POST   | `/api/policies/:id/approve`       | Approve policy           |
| POST   | `/api/policies/:id/reject`        | Reject/send back policy  |
| GET    | `/api/policies/dashboard/metrics` | Dashboard KPIs           |

### Rules (Step 2)
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/rules/:policyId`            | Get rules for policy     |
| POST   | `/api/rules/:policyId`            | Save rules               |
| POST   | `/api/rules/generate-sql`         | Convert rules to SQL     |

### Scoring (Step 3)
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | `/api/scoring/:policyId`              | Get scoring config       |
| POST   | `/api/scoring/:policyId`              | Save scoring config      |
| POST   | `/api/scoring/:policyId/validate`     | Validate weights         |

### Decision Tree (Step 4)
| Method | Endpoint                                  | Description              |
|--------|-------------------------------------------|--------------------------|
| GET    | `/api/decision-tree/:policyId`            | Get decision tree        |
| POST   | `/api/decision-tree/:policyId`            | Save decision tree       |
| POST   | `/api/decision-tree/:policyId/test`       | Test tree with data      |

### Clauses (Step 5)
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | `/api/clauses/:policyId`              | Get clauses              |
| POST   | `/api/clauses/:policyId`              | Save all clauses         |
| POST   | `/api/clauses/:policyId/add`          | Add single clause        |
| PUT    | `/api/clauses/:policyId/:clauseIndex` | Update clause            |
| POST   | `/api/clauses/:policyId/preview`      | Preview with variables   |

### Simulation (Step 6)
| Method | Endpoint                                  | Description              |
|--------|-------------------------------------------|--------------------------|
| POST   | `/api/simulation/:policyId/simulate-full` | Run full simulation      |
| POST   | `/api/simulation/:policyId/validate`      | Validate all steps       |
| GET    | `/api/simulation/:policyId/history`       | Simulation history       |

### Versions
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | `/api/versions/:policyId`             | List versions            |
| POST   | `/api/versions/:policyId/snapshot`    | Create version snapshot  |
| GET    | `/api/versions/:policyId/compare`     | Compare two versions     |

### Approvals
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| GET    | `/api/approvals`                      | Approval queue           |
| GET    | `/api/approvals/dashboard/metrics`    | Approval KPIs            |
| POST   | `/api/approvals/bulk-approve`         | Bulk approve policies    |

---

## 8. Database Schema

### PostgreSQL Tables

```sql
-- Core policy entity
policies (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  policy_type VARCHAR(50),       -- credit_risk | underwriting | collections
  customer_segment VARCHAR(50),  -- retail | sme | corporate | microfinance
  status VARCHAR(20),            -- DRAFT | IN_REVIEW | APPROVED | ACTIVE | REJECTED
  version INTEGER DEFAULT 1,
  effective_date DATE,
  expiry_date DATE,
  description TEXT,
  current_step INTEGER DEFAULT 1,
  created_by VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Multi-select tags
policy_tags (policy_id UUID FK, tag VARCHAR(50))

-- Complete audit trail
policy_audit_log (
  id UUID, policy_id FK,
  action VARCHAR(50),            -- CREATED | UPDATED | SUBMITTED | APPROVED | REJECTED
  performed_by VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP
)

-- Multi-level approval queue
approval_queue (
  id UUID, policy_id FK,
  level_id INTEGER FK,
  status VARCHAR(20),            -- PENDING | APPROVED | REJECTED
  reviewer VARCHAR(100),
  notes TEXT,
  created_at, reviewed_at
)

-- Approval levels (seeded)
approval_levels (
  id SERIAL, name VARCHAR(100), sequence INTEGER
  -- Seeds: Risk Review(1), Compliance(2), Legal(3)
)

-- Version snapshots
policy_versions (
  id UUID, policy_id FK,
  version INTEGER,
  snapshot JSONB,                 -- Full aggregated snapshot
  created_by, created_at
)
```

### MongoDB Collections

| Collection          | Key Fields                                             |
|---------------------|--------------------------------------------------------|
| `policyrules`       | policyId, ruleJson (recursive group/conditions)        |
| `policyscorings`    | policyId, categories[] → parameters[] (field, weight)  |
| `policydecisiontrees`| policyId, tree (recursive condition/action nodes)     |
| `policyclauses`     | policyId, clauses[] (trigger, template, documents[])   |
| `simulationresults` | policyId, applicantData, result, executionTrace[]      |

---

## 9. Environment Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (Neon recommended) or local PostgreSQL
- MongoDB (Atlas or local)

### Environment Variables

Create `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/policy-agent
JWT_SECRET=your-secret-key
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Installation & Running

```bash
# Backend
cd backend
npm install
node src/db/migrate.js   # Run PostgreSQL migrations
node server.js           # Start on port 5000

# Frontend
cd frontend
npm install
npm run dev              # Start on port 3000
```

### Database Migration

The migration script reads `src/db/schema.sql` and executes it against your PostgreSQL database:

```bash
cd backend
node src/db/migrate.js
```

This creates all tables, indexes, and seeds the approval levels.

---

## 10. Design System

The frontend uses a dark theme with CSS custom properties defined in `globals.css`:

| Variable            | Value      | Usage                     |
|---------------------|------------|---------------------------|
| `--bg-primary`      | `#0f1923`  | Page background           |
| `--bg-secondary`    | `#0a1628`  | Sidebar, nested elements  |
| `--bg-card`         | `#162236`  | Card backgrounds          |
| `--accent-blue`     | `#3b82f6`  | Primary actions, links    |
| `--accent-green`    | `#22c55e`  | Success, approved states  |
| `--accent-red`      | `#ef4444`  | Error, rejected states    |
| `--accent-yellow`   | `#eab308`  | Warning, pending states   |
| `--accent-purple`   | `#a855f7`  | Draft, special states     |
| `--text-primary`    | `#e2e8f0`  | Primary text              |
| `--text-secondary`  | `#94a3b8`  | Secondary text            |
| `--text-muted`      | `#64748b`  | Muted labels              |
| `--border-primary`  | `#1e3a5f`  | Card/input borders        |

---

## 11. Key Implementation Details

### Rule-to-SQL Generation
The backend recursively converts the JSON rule tree to SQL:
```
{ operator: "AND", conditions: [...] }
  → (condition1 AND condition2 AND ...)

{ operator: "OR", conditions: [...] }
  → (condition1 OR condition2 OR ...)
```

### Decision Tree Evaluation
Uses recursive depth-first traversal with trace generation. Each node is either:
- **Condition node**: Evaluates a comparison, branches to `then` or `else`
- **Group node**: Evaluates multiple conditions with AND/OR logic
- **Action node**: Terminal — returns decision (APPROVE/REJECT/REVIEW/REFER)

### Version Snapshots
A version snapshot aggregates data from both databases:
```json
{
  "policy": { /* PostgreSQL policy row */ },
  "rules": { /* MongoDB rules document */ },
  "scoring": { /* MongoDB scoring document */ },
  "decisionTree": { /* MongoDB tree document */ },
  "clauses": { /* MongoDB clauses document */ }
}
```

### Version Comparison
Uses recursive JSON diff to compare two snapshots, producing entries:
- `added` — key exists in new but not old
- `removed` — key exists in old but not new
- `changed` — value differs between versions

---

## 12. Security Considerations

- JWT-based authentication (infrastructure ready, tokens via `jsonwebtoken`)
- Password hashing with `bcryptjs`
- CORS configured for cross-origin access
- Input validation on all API endpoints
- Parameterized SQL queries (no SQL injection)
- Approval notes mandatory for governance trail

---

*Documentation generated for Policy Agent v1.0*
