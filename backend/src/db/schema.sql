-- =====================================================
-- POLICY AGENT - PostgreSQL Schema
-- =====================================================

-- Policies table (main entity)
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY,
  policy_id VARCHAR(20) UNIQUE NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_type VARCHAR(100),
  primary_segment VARCHAR(100),
  product VARCHAR(100),
  effective_date DATE,
  expiry_date DATE,
  description TEXT,
  status VARCHAR(50) DEFAULT 'DRAFT',
  current_step INTEGER DEFAULT 1,
  version VARCHAR(10) DEFAULT '1.0',
  is_submitted BOOLEAN DEFAULT FALSE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Policy tags (target customer tags)
CREATE TABLE IF NOT EXISTS policy_tags (
  id UUID PRIMARY KEY,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL
);

-- Policy audit log
CREATE TABLE IF NOT EXISTS policy_audit_log (
  id UUID PRIMARY KEY,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(100),
  comment TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Approval queue
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  version_id UUID,
  submitted_by UUID,
  current_level VARCHAR(50) DEFAULT 'Risk Review',
  assigned_to UUID,
  submitted_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'PENDING',
  priority VARCHAR(20) DEFAULT 'NORMAL'
);

-- Approval levels
CREATE TABLE IF NOT EXISTS approval_levels (
  id SERIAL PRIMARY KEY,
  level_name VARCHAR(100) NOT NULL,
  level_order INTEGER NOT NULL
);

-- Insert default approval levels
INSERT INTO approval_levels (level_name, level_order) VALUES
  ('Risk Review', 1),
  ('Compliance', 2),
  ('Legal', 3)
ON CONFLICT DO NOTHING;

-- Policy versions
CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  version_number VARCHAR(10) NOT NULL,
  json_snapshot JSONB,
  status VARCHAR(50),
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_policy_id ON policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_tags_policy_id ON policy_tags(policy_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_policy_id ON policy_audit_log(policy_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_policy_id ON approval_queue(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy_id ON policy_versions(policy_id);
