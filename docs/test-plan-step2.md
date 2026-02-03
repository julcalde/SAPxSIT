# Step 2 Test Plan – CAP Project Structure Initialization

## Objective
Verify that the CAP project structure is correctly initialized with all required files and configurations.

---

## Test Cases

### TC2.1 - Package.json Validation

**Test**: Review package.json configuration  
**Expected Result**:
- ✅ Project metadata complete (name, version, description, author)
- ✅ Node.js engine >= 18.0.0 specified
- ✅ All required dependencies present:
  - @sap/cds, @sap/xssec, @sap/xsenv
  - jsonwebtoken, uuid, aws-sdk
  - express, passport, helmet, cors
  - joi (validation), express-rate-limit
- ✅ Dev dependencies: eslint, prettier, jest, supertest
- ✅ NPM scripts defined (start, watch, test, lint, build, deploy)
- ✅ CAP configuration with HANA and SQLite profiles
- ✅ Jest configuration with coverage thresholds (70%)

**Success Criteria**: Can run `npm install` without errors

---

### TC2.2 - MTA Descriptor Validation

**Test**: Review mta.yaml structure  
**Expected Result**:
- ✅ Schema version 3.2
- ✅ 3 modules defined: srv, db-deployer, approuter
- ✅ 4 resources defined: xsuaa, destination, objectstore, hana
- ✅ XSUAA resource references xs-security.json
- ✅ Service bindings correct (srv requires all 4 resources)
- ✅ Build parameters configured (before-all with cds build)
- ✅ Memory and disk quotas specified
- ✅ Role collections defined in XSUAA config

**Success Criteria**: MTA YAML is syntactically valid

---

### TC2.3 - XSUAA Security Descriptor

**Test**: Review xs-security.json  
**Expected Result**:
- ✅ xsappname: supplier-onboarding
- ✅ tenant-mode: dedicated
- ✅ 4 scopes defined (matches security architecture)
- ✅ 3 role templates (Purchaser, Admin, Auditor)
- ✅ 3 role collections with correct references
- ✅ OAuth2 configuration with redirect URIs
- ✅ Token validity: 43200 seconds (12 hours)

**Success Criteria**: JSON is valid, scope/role names match documentation

---

### TC2.4 - Project Structure Completeness

**Test**: Verify folder structure  
**Expected Result**:
- ✅ `/db` - database schema folder
- ✅ `/srv` - service layer folder
- ✅ `/test` - test suite folder
- ✅ `/docs` - documentation folder (from Step 1)
- ✅ `/env` - environment config folder
- ✅ `/scripts` - automation scripts folder (future)
- ✅ Root files: package.json, mta.yaml, xs-security.json, server.js
- ✅ Config files: .eslintrc.js, .prettierrc.json, .gitignore

**Success Criteria**: All folders exist, placeholder files present

---

### TC2.5 - ESLint & Prettier Configuration

**Test**: Lint and format configuration  
**Expected Result**:
- ✅ .eslintrc.js extends SAP CDS plugin + prettier
- ✅ Security rules enabled (no-eval, no-new-func)
- ✅ Jest plugin configured
- ✅ .prettierrc.json with consistent formatting rules
- ✅ .prettierignore excludes generated files

**Success Criteria**: Can run `npm run lint` (should pass on empty codebase)

---

### TC2.6 - README Documentation

**Test**: Review README.md completeness  
**Expected Result**:
- ✅ Project description and business value
- ✅ Architecture diagram (ASCII or Markdown)
- ✅ Technology stack listed
- ✅ Getting started instructions
- ✅ Project structure documented
- ✅ Development commands (test, lint, format)
- ✅ Deployment instructions
- ✅ Security section references security-architecture.md
- ✅ API endpoints table
- ✅ Environment variables reference

**Success Criteria**: README is comprehensive and accurate

---

## Common Failure Modes

| Issue | Symptom | Resolution |
|-------|---------|------------|
| npm install fails | Missing peer dependencies | Check Node.js version >= 18 |
| MTA build fails | YAML syntax error | Validate YAML indentation |
| ESLint errors | Linting fails on existing code | Run `npm run lint:fix` |
| Jest not found | Test command fails | Run `npm install` to install devDependencies |
| Missing @sap/cds | CAP commands fail | Install globally: `npm i -g @sap/cds-dk` |

---

## Verification Checklist

Run these commands to verify setup:

```bash
# 1. Validate package.json
npm install --dry-run

# 2. Check CAP configuration
cds version

# 3. Lint check (should pass on empty project)
npm run lint

# 4. Format check
npm run format:check

# 5. Verify MTA structure
mbt --version  # Ensure MBT installed

# 6. Validate xs-security.json syntax
cat xs-security.json | jq .  # Should parse without errors
```

Expected Results:
- [ ] npm install completes without errors
- [ ] CAP version >= 7.5.0 detected
- [ ] ESLint runs without errors
- [ ] Prettier detects no formatting issues
- [ ] MBT tool installed
- [ ] xs-security.json is valid JSON

---

## Automated Verification Script

```bash
#!/bin/bash
echo "=== Step 2 Verification ==="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
  echo "✅ Node.js version: $(node -v)"
else
  echo "❌ Node.js version too old: $(node -v). Require >= 18"
  exit 1
fi

# Check package.json exists
if [ -f "package.json" ]; then
  echo "✅ package.json exists"
else
  echo "❌ package.json missing"
  exit 1
fi

# Check mta.yaml exists
if [ -f "mta.yaml" ]; then
  echo "✅ mta.yaml exists"
else
  echo "❌ mta.yaml missing"
  exit 1
fi

# Check xs-security.json
if [ -f "xs-security.json" ]; then
  echo "✅ xs-security.json exists"
  # Validate JSON syntax
  if jq empty xs-security.json 2>/dev/null; then
    echo "✅ xs-security.json is valid JSON"
  else
    echo "❌ xs-security.json has syntax errors"
    exit 1
  fi
else
  echo "❌ xs-security.json missing"
  exit 1
fi

# Check folder structure
for dir in db srv test docs env; do
  if [ -d "$dir" ]; then
    echo "✅ /$dir folder exists"
  else
    echo "❌ /$dir folder missing"
    exit 1
  fi
done

# Check config files
for file in .eslintrc.js .prettierrc.json .gitignore README.md; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file missing"
    exit 1
  fi
done

echo ""
echo "=== All checks passed! ==="
echo "Ready to proceed to Step 3"
```

---

**Test Plan Status**: ✅ Complete  
**Next Action**: Run verification script, then proceed to Step 3
