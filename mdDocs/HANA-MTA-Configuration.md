# SAP HANA Cloud MTA Configuration Reference

## Overview
HANA Cloud database configuration within `mta.yaml` for CAP applications with HDI (HANA Deployment Infrastructure).

**Reference Source:** [SAP-samples/hana-opensap-cloud-2020](https://github.com/SAP-samples/hana-opensap-cloud-2020/blob/main/mta.yaml#L100)

---

## Key Configuration Patterns

### 1. DB Module Type
```yaml
- name: db
  type: hdb  # HANA Database type (not nodejs)
  path: db
  parameters:
    app-name: <app-name>-db
```

### 2. Service Binding Configuration
```yaml
requires:
  - name: <app-name>-db
    properties:
      TARGET_CONTAINER: '~{hdi-service-name}'  # HDI service binding
```

### 3. Cross-Container Service Replacements
For accessing external databases or shared services:
```yaml
requires:
  - name: cross-container-service-1
    group: SERVICE_REPLACEMENTS
    properties:
      key: ServiceName_1
      service: '~{the-service-name}'
  
  - name: <app-name>-user-db
    group: SERVICE_REPLACEMENTS
    properties:
      key: hdi-user-service
      service: '~{user-container-name}'
```

### 4. Optional: User DB Module
For multi-tier database architecture:
```yaml
- name: user_db
  type: hdb
  path: user_db
  parameters:
    app-name: <app-name>-user-db
```

---

## Application to Supplier Onboarding

### Recommended Structure for sapxsit

```yaml
modules:
  # Service Module
  - name: sapxsit-srv
    type: nodejs
    path: srv
    requires:
      - name: sapxsit-db
      - name: sapxsit-xsuaa
      - name: sapxsit-destination
      - name: sapxsit-connectivity
  
  # Database Module
  - name: sapxsit-db
    type: hdb
    path: db
    parameters:
      app-name: sapxsit-db
    requires:
      - name: sapxsit-db
        properties:
          TARGET_CONTAINER: '~{hdi-service-name}'

resources:
  - name: sapxsit-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared  # or hdi if dedicated needed
  
  - name: sapxsit-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
  
  - name: sapxsit-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
  
  - name: sapxsit-connectivity
    type: org.cloudfoundry.managed-service
    parameters:
      service: connectivity
      service-plan: lite
```

---

## Generation Command

Instead of manual mta.yaml creation, use:
```bash
cds add xsuaa,destination,connectivity
```

This auto-generates compliant mta.yaml with proper HANA, XSUAA, and service bindings.

---

## Best Practices

1. **Use `hdi-shared`** plan for development/testing (cost-effective)
2. **Use `hdi`** plan for production (dedicated HANA instance)
3. **Always specify `TARGET_CONTAINER`** in db module requires
4. **Use service replacements** only when accessing external HANA containers
5. **Follow naming convention:** `<app-name>-<resource-type>` (e.g., `sapxsit-db`, `sapxsit-xsuaa`)

---

## Resources

- [SAP CAP HANA Documentation](https://cap.cloud.sap/docs/guides/databases)
- [SAP BTP HANA Cloud Service](https://help.sap.com/docs/hana-cloud/hana-database/hana-cloud-service)
- [MTA Deployment Descriptor Reference](https://help.sap.com/docs/btp/sap-business-technology-platform/mta-deployment-descriptor-v3-schema)
