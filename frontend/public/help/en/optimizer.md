# Optimizer Steps Guide

This guide explains the optimization steps available in the Ads.txt Manager optimizer tool.

<a id="step1"></a>

## 1. Clean Up Errors & Duplicates

This step focuses on fixing syntax errors and removing redundant entries to ensure your file is valid and concise.

### What it does:
- **Format Errors**: Identifies lines that do not follow the IAB ads.txt specification (e.g., missing commas, invalid characters).
- **Duplicates**: Removes lines that are exact copies of other lines.

### Recommended Action:
- **Remove**: Delete the invalid lines completely.
- **Comment Out**: disable the lines by adding a `#` prefix (e.g., `# INVALID: ...`), useful for auditing.

---

<a id="step2"></a>

## 2. Check Owner Domain

Ensures your ads.txt file correctly declares the owner of the domain (you).

### What it does:
- Checks if `ownerdomain={domain}` is present.
- If missing, it can add it for you.
- Validation: The domain listed in `ownerdomain` should match the domain where the ads.txt file is hosted (or the parent domain).

### Why it's important:
Declaring ownership helps prevent domain spoofing and verifies your identity in the supply chain (Sellers.json).

---

<a id="step3"></a>

## 3. Verify Manager Domain

Validates the `managerdomain` entries if you are using an ads.txt manager or CMP.

### What it does:
- Checks validity of `managerdomain=` entries.
- Verifies if the manager domain has a valid `sellers.json` and lists you as a publisher.

### Recommended Action:
- If a manager domain is invalid or inactive, you should remove it.

---

<a id="step4"></a>

## 4. Relationship Correction

Corrects the `DIRECT` vs `RESELLER` field based on the advertising system's `sellers.json` data.

### What it does:
- Queries the `sellers.json` file of each advertising system (e.g., google.com).
- Checks your Account ID in their list.
- **Correction**:
    - If you are listed as `PUBLISHER` in sellers.json, the ads.txt entry should be `DIRECT`.
    - If you are listed as `INTERMEDIARY` in sellers.json, the ads.txt entry should be `RESELLER`.

### Why it's important:
 Mismatched relationship types can lead to revenue loss or warning flags from DSPs.

---

<a id="step5"></a>

## 5. Verify Sellers

Validates that the Seller IDs listed in your ads.txt actually exist in the partner's `sellers.json` file.

### What it does:
- Cross-references every line in your ads.txt with the corresponding `sellers.json`.
- **Zero-step**: If the Seller ID is not found in the `sellers.json` file, it implies the ID is invalid or inactive.

### Recommended Action:
- **Remove**: If the ID doesn't exist, the line is likely useless.
- **Comment**: Keep it for record but disable it.

---
