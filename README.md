# Unified Supplier Management System

A complete, production-grade supplier management system with secure token-based access and document handling. Built with SAP Cloud Application Programming Model (CAP).

## Features

### Core Functionality
- **Secure Token Authentication**: Crypto-based tokens converted to JWT sessions with httpOnly cookies
- **External Supplier Access**: Token-verified interface for order viewing and delivery confirmation
- **Admin Panel**: Internal management UI for creating suppliers/orders, managing documents, and generating links
- **Document Management**: Upload, download, delete PDFs with status tracking and admin feedback
- **Email Integration**: Automated verification emails with secure access links
- **File Upload**: Support for PDF and image attachments with validation
- **Status Tracking**: Order and document status with color-coded UI indicators

### New Features (Feb 2026)
- **4-Digit PIN 2FA**: Two-factor authentication with hashed PINs for supplier access
  - Random PIN generation on supplier creation
  - PIN entry page with max 3 attempts
  - Automatic token lockout after failed attempts
  - Secure PIN hashing with salt (never stored in plain text)
- **Anti-Phishing Verification Page**: Public link verification tool at `/verify-link`
  - Verify link authenticity without clicking
  - Shows order details, creation date, expiration status
  - Warning levels (safe/warning/danger) with color-coded UI
  - Protects suppliers from phishing attacks
- **Supplier Creation**: Create new suppliers with auto-generated IDs (SUP-XXXXXXXX format)
- **Order + Token Creation**: Generate orders with verification tokens in single action
- **Soft Delete System**: 
  - Archive/restore suppliers (with active order validation)
  - Cancel/restore orders (with reason tracking and automatic token revocation)
  - Filter archived/cancelled items with checkboxes
  - Visual indicators (status badges, dimmed rows)
  - Metadata tracking (who/when for archive/cancel actions)
- **PDF Management**: Full download support for suppliers in external view, upload/download/delete for admins
- **Enhanced UI**: Status badges, action buttons, real-time filtering

## Project Structure

```
SAPxSIT/
├─ app/
│  ├─ admin/             # Internal admin panel
│  │  ├─ index.html      # Admin UI with Tailwind CSS
│  │  └─ js/
│  │     ├─ api.js       # Internal service API client
│  │     ├─ ui.js        # UI rendering functions
│  │     └─ main.js      # Event handlers and initialization
│  └─ external/          # External supplier interface
│     ├─ index.html      # Supplier order details page
│     └─ js/
│        ├─ api.js       # External service API client with JWT
│        ├─ ui.js        # UI rendering functions
│        └─ main.js      # Event handlers and initialization
├─ srv/
│  ├─ internal-srv.cds   # Internal service definition
│  ├─ internal-srv.js    # Link generation, email, admin actions
│  ├─ external-srv.cds   # External service definition
│  ├─ external-srv.js    # Supplier actions with JWT auth
│  ├─ token-verify-srv.cds # Token verification service
│  ├─ token-verify-srv.js  # Token to JWT conversion
│  └─ email/
│     ├─ email-styles.css
│     └─ standardEmail.html
├─ db/
│  ├─ schema.cds         # Domain model (Suppliers, Orders, Documents, Tokens)
│  └─ data/              # CSV test data
└─ utils/
   └─ emailService.js    # Email sending utilities

```

## Business Flow

### Admin Workflow
1. **Create Supplier**: Fill form with name/email → Auto-generated SUP-XXXXXXXX ID
2. **Create Order + Token**: Select supplier → Click "Create Order" → Instant order with verification URL
3. **View Suppliers & Orders**: Access admin panel at `/admin/index.html`
4. **Generate Secure Link**: Click "Generate Link" for an order (alternative to step 2)
5. **Send Email**: Optionally send automated verification email with link
6. **Manage Documents**: Upload, download, delete PDFs; review and update status
7. **Archive/Cancel**: Archive suppliers or cancel orders with tracking
8. **Filter Views**: Toggle archived suppliers and cancelled orders visibility

### Supplier Workflow
1. **Receive Email**: Get verification email with secure access link
2. **Access Order**: Click link → token verified → JWT session created
3. **View Details**: See order information and existing documents
4. **Download Documents**: Click download button for any document
5. **Confirm Delivery**: Submit delivery date and notes
6. **Upload Documents**: Add PDF/image files for verification

## Getting Started

### Prerequisites

- Node.js (LTS version)
- @sap/cds-dk (SAP Cloud Application Programming Model CLI)

### Installation

```bash
npm install
```

### Development

```bash
# Start the CAP server
npm start

# Or with watch mode
cds watch
```

This will start the CAP server on http://localhost:4004

### Database Setup

The application uses SQLite for development. Database is automatically initialized from CSV data files in `db/data/`.

```bash
# Recreate database (if needed)
rm -f db.sqlite
npx cds deploy --to sqlite
```

### Access Points

- **Admin Panel**: http://localhost:4004/admin/index.html
- **External Access**: Via secure token link (generated from admin panel)
- **Internal Service**: http://localhost:4004/service/internal
- **External Service**: http://localhost:4004/service/external (requires JWT)
- **Token Verification**: http://localhost:4004/service/verify

## Testing

Comprehensive backend testing completed (Feb 11, 2026):
- ✅ Supplier creation with auto-generated IDs
- ✅ Order + token creation in single action
- ✅ Archive supplier validation (blocks when active orders exist)
- ✅ Cancel order with reason tracking
- ✅ Restore operations for suppliers and orders
- ✅ Token generation and validation
- ✅ JWT session creation
- ✅ Email integration
- ✅ Document status updates
- ✅ Delivery confirmation
- ✅ Security controls (token reuse, status validation, automatic token revocation)

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed test procedures and results.

### Frontend Testing Checklist

1. **Admin Panel**:
   - [ ] Create new supplier (form with auto-generated ID)
   - [ ] Create order with token (single-click order generation)
   - [ ] View suppliers and orders
   - [ ] Archive/restore suppliers
   - [ ] Cancel/restore orders
   - [ ] Filter archived suppliers and cancelled orders
   - [ ] Upload/download/delete documents
   - [ ] Generate secure access link
   - [ ] Send verification email
   - [ ] Update document status

2. **External Supplier Access**:
   - [ ] Access via secure token link
   - [ ] View order details
   - [ ] Download documents
   - [ ] Confirm delivery with date and notes
   - [ ] Upload documents (PDF/images)
   - [ ] View existing documents with status

## Security Architecture

- **Crypto Tokens**: Random 64-character hex tokens for initial verification
- **JWT Sessions**: httpOnly cookies with 24-hour expiration
- **Token Validation**: Single-use, time-limited (42h 13m 37s default)
- **Token Revocation**: Automatic revocation when orders are cancelled
- **Authorization**: Order-scoped access via JWT claims
- **File Validation**: Type and size restrictions on uploads
- **Status Controls**: Validated against DocumentStatus code list
- **Soft Delete**: Archive/cancel operations preserve data integrity with metadata tracking

## Email Configuration

The system uses Nodemailer for email delivery. Configure SMTP settings in environment variables:

```bash
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
```

For Gmail, use App Passwords: https://myaccount.google.com/apppasswords

## API Endpoints

### Internal Service (`/service/internal`)
- `GET /Suppliers` - List all suppliers
- `GET /Orders` - List all orders
- `GET /Documents` - List all documents
- `POST /createSupplier` - Create new supplier with auto-generated ID
- `POST /createOrderAndToken` - Create order with verification token in one action
- `POST /generateSecureLink` - Generate access token for existing order
- `POST /sendVerificationEmail` - Send email with link
- `POST /archiveSupplier` - Archive supplier (validates no active orders)
- `POST /restoreSupplier` - Restore archived supplier
- `POST /cancelOrder` - Cancel order with reason (auto-revokes tokens)
- `POST /restoreOrder` - Restore cancelled order
- `POST /uploadDocumentContent` - Upload document file content
- `POST /createDocumentForOrder` - Create document metadata
- `DELETE /Documents(ID)` - Delete document
- `PATCH /Documents(ID)` - Update document status

### External Service (`/service/external`)
- `GET /Orders` - View authorized order (JWT required)
- `GET /Documents` - View order documents (JWT required)
- `POST /confirmDelivery` - Confirm delivery (JWT required)
- `POST /uploadDocument` - Upload document (JWT required)

### Token Verification (`/service/verify`)
- `GET /verifyAndRedirect` - Verify token and create JWT session

## Development Notes

- Frontend uses Tailwind CSS via CDN (no build step required)
- JavaScript modules with clean separation (api.js, ui.js, main.js)
- Base64 encoding for document uploads
- Files stored in `/uploads` directory
- Test data provided in `db/data/*.csv`

## Reference

See [mdDocs/guidelines.md](mdDocs/guidelines.md) for detailed development guidelines.

For SAP CAP documentation: https://cap.cloud.sap/docs/
