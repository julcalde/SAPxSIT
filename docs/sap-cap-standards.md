# SAP CAP Standards & Best Practices

**Reference:** https://cap.cloud.sap/docs/  
**Date Reviewed:** February 3, 2026

## Project Structure

Standard CAP project layout:
```
project/
├─ app/          # UI-related content
├─ srv/          # Service-related content (CAP services)
├─ db/           # Domain models and database content
├─ package.json  # Configuration for cds + cds-dk
└─ README.md
```

**Convention over Configuration** - Stick to CAP's defaults to benefit from out-of-the-box features.

---

## Domain Modeling Best Practices

### 1. **Naming Conventions**

✅ **DO:**
- Capitalize entity/type names: `Authors`, `Books`
- Lowercase element names: `name`, `title`
- **Pluralize entity names**: `Authors` not `Author`
- Use singular for types: `Genre` not `Genres`
- Prefer concise names: `address` not `addressInformation`
- Use `ID` for technical primary keys
- Don't repeat contexts: `Authors.name` not `Authors.authorName`

❌ **DON'T:**
- Use overly long names
- Repeat context in element names
- Use non-standard key naming

### 2. **Primary Keys**

✅ **DO:**
- Prefer **simple, technical keys** (single field)
- Use **canonic keys** with `cuid` aspect from `@sap/cds/common`
- Prefer **UUIDs** for universal uniqueness
- Auto-filled UUID keys using `cuid` aspect

```cds
using { cuid } from '@sap/cds/common';
entity Books : cuid {
  // ID : UUID automatically added
  title : String;
}
```

❌ **DON'T:**
- Use complex composite keys
- Use binary data as keys
- Interpret or validate UUID formats (they're opaque values)
- Use database sequences unless dealing with high data volumes

### 3. **Associations & Compositions**

✅ **DO:**
- **Prefer managed associations** for to-one relationships
- Use **Compositions** for document structures (parent-child, cascading delete)
- Use backlink associations with `$self` for to-many

```cds
entity Books {
  author : Association to Authors;  // managed :1
}
entity Authors {
  books : Association to many Books on books.author = $self;  // to-many
}
entity Orders {
  Items : Composition of many OrderItems on Items.parent = $self;
}
```

### 4. **Reuse Common Types**

✅ **DO:**
- Use `@sap/cds/common` for standard types and aspects

```cds
using { cuid, managed, Country, Currency } from '@sap/cds/common';

entity Books : cuid, managed {
  title    : String;
  price    : Decimal;
  currency : Currency;
}
```

**Common Aspects:**
- `cuid` - Adds `key ID : UUID`
- `managed` - Adds `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` with auto-fill
- `temporal` - For time-dependent data

### 5. **Data Modeling Philosophy**

✅ **DO:**
- **Capture intent, not implementation** ("What, not How")
- Keep models **flat** (avoid deep nesting of structured types)
- Use **localized** qualifier for multi-language text
- Keep core domain model **clean** - use aspects for cross-cutting concerns

```cds
entity Books {
  title : localized String;  // CAP generates .texts entity behind scenes
  descr : localized String;
}
```

---

## Service Definitions

### 1. **Service-Centric Paradigm**

Every active thing in CAP is a service:
- Services define **behavioral aspects**
- Services act as **facades** to domain data
- Services expose **denormalized views** tailored to use cases

### 2. **Single-Purposed Services** (Best Practice)

✅ **DO:** One service per use case

```cds
// Serves end users browsing catalog
service CatalogService {
  @readonly entity Books as projection on my.Books {
    ID, title, author.name as author
  } excluding { createdBy, modifiedBy };
}

// Serves administrators
@requires: 'authenticated-user'
service AdminService {
  entity Books as projection on my.Books;
  entity Authors as projection on my.Authors;
}
```

❌ **DON'T:**
- Create single services exposing all entities 1:1
- Mix multiple use cases in one service

### 3. **Services as Projections**

```cds
using { sap.capire.bookshop as my } from '../db/schema';

service CatalogService {
  entity Books as projection on my.Books;
  entity Authors as projection on my.Authors;
  action submitOrder (book : Books:ID, quantity : Integer);
}
```

**Benefits:**
- Associations automatically redirected to service entities
- Composition targets auto-exposed
- Denormalized views tailored to specific use cases

---

## Event Handlers & Custom Logic

### 1. **Event Handler Hooks**

```javascript
module.exports = function() {
  this.before('CREATE', 'Books', req => {
    // runs before CREATE, for validation
  });
  
  this.on('CREATE', 'Books', req => {
    // custom implementation, replaces generic handler
  });
  
  this.after('READ', 'Books', books => {
    // runs after READ, augment results
  });
}
```

**Hooks:**
- `before` - validation, input checks (runs before `on`)
- `on` - custom implementation (replaces generic handler)
- `after` - augment results, post-processing

### 2. **File Naming Convention**

```
srv/
  cat-service.cds   # service definition
  cat-service.js    # service implementation
```

Node.js automatically loads `.js` files matching `.cds` file names.

---

## Annotations & Aspects

### 1. **Separation of Concerns**

Keep core domain model clean - use separate files for:

```cds
// db/schema.cds - Core domain
entity Books : cuid, managed {
  title : String;
  author : Association to Authors;
}
```

```cds
// srv/auth.cds - Authorization
using { Books } from '../db/schema';
annotate Books with @restrict: [
  { grant: 'READ', to: 'authenticated-user' },
  { grant: 'UPDATE', to: 'admin' }
];
```

```cds
// app/fiori-annotations.cds - UI Annotations
using { Books } from '../db/schema';
annotate Books with @(
  UI.LineItem: [
    { Value: title },
    { Value: author.name }
  ]
);
```

### 2. **Managed Data**

Auto-fill fields using `@cds.on.insert` and `@cds.on.update`:

```cds
using { managed } from '@sap/cds/common';
entity Foo : managed {
  // Automatically gets:
  // createdAt  : Timestamp @cds.on.insert: $now
  // createdBy  : User      @cds.on.insert: $user
  // modifiedAt : Timestamp @cds.on.update: $now
  // modifiedBy : User      @cds.on.update: $user
}
```

---

## Generic Providers

CAP runtimes provide out-of-the-box:

1. **CRUD Operations** - GET, POST, PUT/PATCH, DELETE
2. **Deep Read/Write** - Nested compositions with cascading operations
3. **Auto-Generated Keys** - UUID keys filled automatically
4. **Pagination** - Default 1000 records with `$skip` and `$top`
5. **Sorting** - Implicit sorting by primary key
6. **Searching** - `$search` query option with `@cds.search` annotation
7. **Concurrency Control** - ETags with `@odata.etag` annotation

---

## Actions & Functions

```cds
service BookshopService {
  // Unbound action (modifies data)
  action submitOrder (book: Books:ID, quantity: Integer);
  
  // Unbound function (reads data)
  function calculateDiscount (price: Decimal) returns Decimal;
  
  entity Books { /*...*/ } actions {
    // Bound to specific Books instance
    action restock (quantity: Integer);
    
    // Bound function
    function getStockLevel() returns Integer;
  }
}
```

**Implementation:**

```javascript
module.exports = function() {
  this.on('submitOrder', async req => {
    const { book, quantity } = req.data;
    // implementation
  });
  
  this.on('restock', 'Books', async req => {
    const { ID } = req.params[0];  // bound entity key
    const { quantity } = req.data;
    // implementation
  });
}
```

---

## Key Architectural Principles

### 1. **Hexagonal Architecture**

CAP implements Hexagonal Architecture (Ports & Adapters):
- **Inner Hexagon**: Domain models + Application services (protocol-agnostic)
- **Outer Hexagon**: Protocol adapters (OData, REST, GraphQL)
- **Benefit**: Develop/test in isolation ("Airplane Mode"), swap protocols

### 2. **Models Fuel Runtimes**

CDS models drive generic service providers - the more declarative information captured, the less custom code needed.

### 3. **Agnostic by Design**

Services remain agnostic to:
- Protocols (OData, REST, GraphQL)
- Local vs Remote calls
- Databases (HANA, PostgreSQL, SQLite)
- Platform services

### 4. **Late-Cut Microservices**

Design loosely-coupled services that can:
- Start as monolith (all services in one process)
- Split into microservices later without code changes
- Avoid premature microservice overhead

---

## Development Workflow

### Prerequisites
- Node.js 18+
- `@sap/cds-dk` globally installed
- SQLite (development) or HANA Cloud (production)

### Commands
```bash
cds init <project>           # Initialize project
cds watch                    # Development mode with auto-reload
cds serve                    # Start server
cds build                    # Production build
cds deploy --to hana         # Deploy to HANA
```

### Project Configuration (`package.json`)

```json
{
  "cds": {
    "requires": {
      "db": {
        "[development]": { "kind": "sqlite", "credentials": { "database": "db.sqlite" } },
        "[production]": { "kind": "hana" }
      },
      "auth": {
        "[development]": { "kind": "mocked" },
        "[production]": { "kind": "xsuaa" }
      }
    }
  }
}
```

---

## Summary of Applied Standards

For our **Supplier Self-Onboarding** project, I will:

1. ✅ Use `cuid` and `managed` aspects from `@sap/cds/common`
2. ✅ Name entities in plural: `SupplierInvitations`, `AuditLogs`
3. ✅ Use managed associations for `invitation.requester`
4. ✅ Use Compositions for `invitation.attachments`
5. ✅ Keep authorization annotations in separate file
6. ✅ Define single-purposed services (TokenService, OnboardingService, AdminService)
7. ✅ Use `@readonly` for audit logs
8. ✅ Implement event handlers in `srv/*.js` files
9. ✅ Use `before` handlers for validation, `on` for custom logic, `after` for augmentation
10. ✅ Leverage generic CRUD providers, add custom logic only where needed

---

**Next Steps:**
- Proceed with Step 3: Validate/enhance XSUAA security descriptor
- Then Step 4: Design CAP data model following these standards
- Continue with test-driven approach for each step
