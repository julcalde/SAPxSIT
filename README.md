# Unified Supplier Management System

**Version 1.0.0** | Production-Ready Supplier Portal with Advanced Security

A complete supplier management system built with SAP Cloud Application Programming Model (CAP), featuring secure token-based authentication, 4-digit PIN two-factor authentication, anti-phishing protection, and automated email notifications.

---

## 🎯 Overview

The Unified Supplier Management System provides a secure, user-friendly platform for managing supplier interactions, order verification, and document exchange. Suppliers receive secure verification links via email, authenticate using a 4-digit PIN, and access a dedicated portal to confirm deliveries and upload documents.

### Key Highlights

- ✅ **Enterprise-grade security** with JWT sessions and PIN-based 2FA
- 📧 **Automated email notifications** with Ethereal/SMTP integration
- 🛡️ **Anti-phishing protection** with public link verification tool
- 📱 **Modern, responsive UI** with Tailwind CSS
- 🔒 **HttpOnly cookies** for BAS (Business Application Studio) compatibility
- 📄 **Complete document management** with upload/download capabilities

---

## 🚀 Features

### Security & Authentication

- **4-Digit PIN Two-Factor Authentication**
  - Random PIN generation on supplier creation (shown only once)
  - Secure PIN storage with SHA-256 hashing and salt
  - Maximum 3 PIN attempts before token lockout
  - Automatic token revocation after failed attempts

- **Token-Based Access Control**
  - 64-character cryptographic tokens
  - Configurable expiration (default: 42 hours)
  - Token revocation and status tracking
  - JWT session tokens (24-hour validity)

- **Anti-Phishing Verification**
  - Public link verification at `/verify-link/index.html`
  - Verify link authenticity before clicking
  - Color-coded safety indicators (green/yellow/red)
  - Shows order details and expiration status

### Supplier Portal Features

- **Order Access**
  - View order details, amounts, and delivery information
  - Secure PIN-protected access
  - 24-hour session persistence (no re-login needed)

- **Delivery Confirmation**
  - Confirm delivery with date and notes
  - Automatic admin email notification
  - Delivery status tracking

- **Document Management**
  - Upload supporting documents (invoices, delivery notes, etc.)
  - Download uploaded documents
  - Document type categorization
  - Status tracking

### Admin Panel Features

- **Supplier Management**
  - Create suppliers with auto-generated IDs (`SUP-XXXXXXXX`)
  - 4-digit PIN generated and displayed (save immediately!)
  - Archive/restore suppliers
  - Email address management

- **Order & Token Management**
  - Create orders with automatic token generation
  - Send verification emails with secure links
  - View all orders with supplier information
  - Cancel/restore orders with reason tracking

- **Document Administration**
  - View all uploaded documents
  - Download and delete documents
  - Document status updates with admin feedback
  - Filter by status

### Email Notifications

- **Verification Emails**
  - Sent to suppliers with secure access links
  - Styled HTML templates with CSS
  - Includes order number and expiration date
  - Configurable SMTP or Ethereal (testing)

- **Admin Notifications**
  - Delivery confirmation alerts
  - Includes delivery date and notes
  - Automated on supplier delivery confirmation

---

## 📁 Project Structure

```
SAPxSIT/
├── app/                          # Frontend applications
│   ├── admin/                    # Admin panel
│   │   ├── index.html           # Main admin interface
│   │   └── js/
│   │       ├── api.js           # API client
│   │       ├── ui.js            # UI rendering
│   │       └── main.js          # Event handlers
│   ├── external/                 # Supplier portal
│   │   ├── index.html           # Supplier interface
│   │   └── js/
│   │       ├── api.js           # External API client
│   │       ├── ui.js            # UI components
│   │       └── main.js          # Portal logic
│   ├── pin/                      # PIN verification (2FA)
│   │   └── index.html           # 4-digit PIN entry page
│   └── verify-link/              # Anti-phishing tool
│       └── index.html           # Link verification page
├── srv/                          # Backend services
│   ├── internal-srv.cds         # Admin service definition
│   ├── internal-srv.js          # Admin service logic
│   ├── external-srv.cds         # Supplier service definition
│   ├── external-srv.js          # Supplier service logic
│   ├── token-verify-srv.cds     # Token verification definition
│   ├── token-verify-srv.js      # PIN & token verification
│   ├── templates/                # Email templates
│   │   ├── verification-email.html
│   │   └── email-styles.css
│   └── utils/
│       └── url-generator.js     # Public URL generation
├── db/                           # Database
│   ├── schema.cds               # Data model
│   └── undeploy.json            # Deployment config
├── utils/                        # Shared utilities
│   └── emailService.js          # Email sending with Ethereal
├── test/                         # Test data
│   └── data/                    # CSV test data
├── .env                          # Environment configuration
├── package.json                  # Dependencies
└── README.md                     # This file
```

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- SQLite (for local development)
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SAPxSIT
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Edit `.env` file:
   ```env
   # Email Configuration (Ethereal for testing, or real SMTP)
   EMAIL_HOST=smtp.ethereal.email
   EMAIL_PORT=587
   EMAIL_USER=                        # Auto-generated if empty
   EMAIL_PASS=                        # Auto-generated if empty
   
   # Public URL
   PUBLIC_BASE_URL=http://localhost:4004
   
   # JWT Secret (change in production!)
   JWT_SECRET=change-this-secret-key-in-production
   
   # PIN Salt (change in production!)
   PIN_SALT=pin-salt-change-in-production
   ```

4. **Deploy database**
   ```bash
   npx cds deploy
   ```

5. **Start the server**
   ```bash
   npx cds watch
   ```

6. **Access the application**
   - Admin Panel: http://localhost:4004/admin/index.html
   - Anti-Phishing Tool: http://localhost:4004/verify-link/index.html

---

## 📖 Usage Guide

### For Administrators

#### 1. Create a Supplier

1. Open Admin Panel: `http://localhost:4004/admin/index.html`
2. Navigate to "Suppliers" tab
3. Click "Create New Supplier"
4. Fill in:
   - Name
   - Email address
5. Click "Create Supplier"
6. **IMPORTANT**: Save the 4-digit PIN shown (it won't be displayed again!)

#### 2. Create Order & Generate Verification Link

1. Navigate to "Orders" tab
2. Click "Create New Order"
3. Select supplier from dropdown
4. Fill in order details:
   - Order number
   - Description (optional)
   - Total amount (optional)
   - Expiration hours (default: 42)
5. Click "Generate Secure Link"
6. Copy the verification URL
7. Optionally send email notification

#### 3. Manage Documents

1. Navigate to "Documents" tab
2. View all uploaded documents
3. Download documents using download button
4. Update status or add admin feedback
5. Delete documents if needed

### For Suppliers

#### 1. Verify Link Authenticity (Recommended)

1. Before clicking the link, visit: `http://localhost:4004/verify-link/index.html`
2. Paste the verification URL you received
3. Click "🔍 Verify Link"
4. Check for green "safe" status
5. Verify order details are correct

#### 2. Access Order Portal

1. Click the verification link received via email
2. You'll be redirected to PIN entry page
3. Enter the 4-digit PIN (provided separately by admin)
4. Auto-submits when 4 digits entered
5. On success: redirected to order portal

#### 3. View Order Details

- Order number, description, total amount
- Delivery dates and status
- All order-related information

#### 4. Confirm Delivery

1. Click "Confirm Delivery"
2. Select delivery date
3. Add delivery notes (optional)
4. Click "Confirm"
5. Admin receives automatic email notification

#### 5. Upload Documents

1. Click "Choose File" or drag-and-drop
2. Select document type (invoice, delivery note, etc.)
3. Add description
4. Click "Upload Document"
5. Document appears in list

---

## 🔒 Security Features

### PIN Two-Factor Authentication

- **Generation**: Random 4-digit PIN on supplier creation
- **Storage**: SHA-256 hashed with salt (never plain text)
- **Attempts**: Maximum 3 attempts before lockout
- **Display**: Shown only once during creation
- **Transmission**: Should be sent via separate channel (SMS, phone, etc.)

### Token Security

- **Format**: 64-character hexadecimal
- **Algorithm**: Cryptographically secure random generation
- **Expiration**: Configurable (default: 42 hours, 13 minutes, 37 seconds)
- **Revocation**: Automatic on PIN failure or manual by admin
- **Single Use**: Token locked after successful PIN verification

### Session Management

- **JWT Tokens**: Signed with secret key
- **HttpOnly Cookies**: Browser-managed, JavaScript-inaccessible
- **Duration**: 24 hours (86400 seconds)
- **Automatic Renewal**: No, session expires after 24h

### Anti-Phishing Protection

- **Public Verification**: No authentication required
- **Token Validation**: Checks database for authenticity
- **Status Indicators**: Visual feedback (green/yellow/red)
- **Information Display**: Shows order details if valid
- **Education**: Phishing warning signs included

---

## 🌐 API Endpoints

### Internal Service (Admin)

**Base URL**: `/service/internal`

#### Suppliers
- `GET /Suppliers` - List all suppliers
- `POST /createSupplier` - Create supplier with PIN
  ```json
  {
    "name": "Company Name",
    "email": "contact@company.com"
  }
  ```
  Returns: `{ supplierID, name, email, pinHash, pin }`

#### Orders
- `GET /Orders?$expand=supplier` - List orders with supplier info
- `POST /createOrderAndToken` - Create order with verification token
  ```json
  {
    "supplierId": "uuid"
  }
  ```
  Returns: `{ orderId, token, verifyUrl, supplierPin, note }`

#### Email
- `POST /sendVerificationEmail` - Send email to supplier
  ```json
  {
    "orderID": "uuid"
  }
  ```

### External Service (Supplier)

**Base URL**: `/service/external`

**Authentication**: Required (JWT in httpOnly cookie)

- `GET /Order` - Get current order details
- `GET /Documents` - List order documents
- `POST /confirmDelivery` - Confirm delivery
  ```json
  {
    "deliveryDate": "2026-02-12",
    "notes": "Delivery notes"
  }
  ```
- `POST /uploadDocument` - Upload document (multipart/form-data)

### Token Verification Service

**Base URL**: `/service/verify`

#### Token Verification
- `GET /verifyAndRedirect?token={token}` - Verify token, redirect to PIN page
  - Returns: 302 redirect to `/pin/index.html?token={token}`

#### PIN Verification
- `POST /verifyPin` - Verify 4-digit PIN
  ```json
  {
    "token": "64-char-hex",
    "pin": "1234"
  }
  ```
  Returns: `{ success, orderID, sessionToken, expiresIn, message }`

#### Link Authenticity (Public)
- `POST /checkLinkAuthenticity` - Verify link without authentication
  ```json
  {
    "urlOrToken": "url-or-token-string"
  }
  ```
  Returns: `{ isValid, warningLevel, message, orderNumber, supplierName, expiresAt }`

---

## 📧 Email Configuration

### Using Ethereal (Development/Testing)

Ethereal is a fake SMTP service that captures emails and provides preview URLs.

**Configuration**: Leave EMAIL_USER and EMAIL_PASS empty in `.env`

The system will auto-generate Ethereal credentials on startup and log:
```
[EmailService] ✅ Ethereal test account created:
   Email: xxxxx@ethereal.email
   Password: xxxxx
```

When emails are sent, check console for preview URLs:
```
[EmailService] 📧 Preview URL: https://ethereal.email/message/xxxxx
```

### Using Real SMTP (Production)

**Gmail Example**:
1. Enable 2-Step Verification in Google Account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

**Other SMTP Providers**: Update host, port, credentials accordingly

---

## 🧪 Testing

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions including:
- Frontend testing routes (supplier & admin)
- Backend API testing
- Security feature testing
- Email notification testing

---

## 🚀 Deployment

### Environment Variables

**Production Checklist**:
- [ ] Change `JWT_SECRET` to strong random string
- [ ] Change `PIN_SALT` to strong random string
- [ ] Configure real SMTP credentials
- [ ] Update `PUBLIC_BASE_URL` to production domain
- [ ] Set `NODE_ENV=production`

### Database Migration

For production databases:
```bash
npx cds deploy --to <database>
```

### Starting in Production

```bash
NODE_ENV=production npm start
```

---

## 📝 Database Schema

### Key Entities

**Suppliers**
- ID, supplierID, name, email
- `pinHash` - SHA-256 hashed PIN
- isActive, archivedAt, archivedBy

**Orders**
- ID, orderNumber, description, totalAmount
- supplier_ID (association)
- status, deliveryDate, deliveryNotes
- cancelledAt, cancelReason, cancelledBy

**AccessTokens**
- ID, token (64-char hex)
- order_ID (association)
- expiresAt, revoked, linkInUse
- `pinAttempts` - Failed PIN attempt counter
- createdBy, revokedAt, revokedBy

**Documents**
- ID, fileName, fileSize, mimeType
- order_ID (association)
- documentType, description
- status, uploadedAt, adminFeedback

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

UNLICENSED - Private use only

---

## 🆘 Troubleshooting

### Email not sending
- Check console for `[EmailService]` logs
- Verify EMAIL_HOST, EMAIL_PORT credentials
- For Ethereal: emails won't reach real inboxes (use preview URL)
- For Gmail: ensure App Password (not regular password)

### PIN verification failing
- Check console for `[TokenVerification]` logs
- Verify PIN was saved from supplier creation
- Check pinAttempts count (max 3)
- Token may be locked after failed attempts

### Session/Cookie issues in BAS
- Ensure `credentials: 'include'` in fetch requests
- Check browser DevTools → Application → Cookies
- HttpOnly cookies won't appear in `document.cookie`
- Verify `external_session` cookie exists

### File upload 413 error
- Check `package.json` for body-parser limits
- Current limit: 100mb for json/text/urlencoded
- For larger files, increase `cds.server` limits

---

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for common scenarios
- Review console logs for detailed error messages

---

**Built with ❤️ using SAP CAP, Node.js, and modern web technologies**
