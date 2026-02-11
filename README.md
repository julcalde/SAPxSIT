# Unified Supplier Management System

A complete, production-grade supplier management system with secure token-based access and document handling. Built with SAP Cloud Application Programming Model (CAP).

## Features

- **Secure Token Authentication**: Crypto-based tokens converted to JWT sessions with httpOnly cookies
- **External Supplier Access**: Token-verified interface for order viewing and delivery confirmation
- **Admin Panel**: Internal management UI for generating links, sending emails, and managing documents
- **Document Management**: Upload, review, and status tracking with admin feedback
- **Email Integration**: Automated verification emails with secure access links
- **File Upload**: Support for PDF and image attachments with validation
- **Status Tracking**: Order and document status with color-coded UI indicators

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
1. **View Suppliers & Orders**: Access admin panel at `/app/admin/index.html`
2. **Generate Secure Link**: Click "Generate Link" for an order
3. **Send Email**: Optionally send automated verification email with link
4. **Manage Documents**: Review uploaded documents, update status, provide feedback

### Supplier Workflow
1. **Receive Email**: Get verification email with secure access link
2. **Access Order**: Click link → token verified → JWT session created
3. **View Details**: See order information and existing documents
4. **Confirm Delivery**: Submit delivery date and notes
5. **Upload Documents**: Add PDF/image files for verification

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

- **Admin Panel**: http://localhost:4004/app/admin/index.html
- **External Access**: Via secure token link (generated from admin panel)
- **Internal Service**: http://localhost:4004/service/internal
- **External Service**: http://localhost:4004/service/external (requires JWT)
- **Token Verification**: http://localhost:4004/service/verify

## Testing

Comprehensive backend testing has been completed covering:
- ✅ Token generation and validation
- ✅ JWT session creation
- ✅ Email integration
- ✅ Document status updates
- ✅ Delivery confirmation
- ✅ Security controls (token reuse, status validation)

### Frontend Testing Checklist

1. **Admin Panel**:
   - [ ] View suppliers and orders
   - [ ] Generate secure access link
   - [ ] Send verification email
   - [ ] View order documents
   - [ ] Update document status

2. **External Supplier Access**:
   - [ ] Access via secure token link
   - [ ] View order details
   - [ ] Confirm delivery with date and notes
   - [ ] Upload documents (PDF/images)
   - [ ] View existing documents with status

## Security Architecture

- **Crypto Tokens**: Random 64-character hex tokens for initial verification
- **JWT Sessions**: httpOnly cookies with 24-hour expiration
- **Token Validation**: Single-use, time-limited (15 minutes default)
- **Authorization**: Order-scoped access via JWT claims
- **File Validation**: Type and size restrictions on uploads
- **Status Controls**: Validated against DocumentStatus code list

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
- `POST /generateSecureLink` - Generate access token
- `POST /sendVerificationEmail` - Send email with link
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
