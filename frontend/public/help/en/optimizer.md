# Optimizer Steps Guide

This guide explains the optimization steps available in the Ads.txt Manager optimizer tool.

<a id="step1"></a>

## 1. Clean Up Errors & Duplicates

This step fixes syntax errors and removes redundant entries in your ads.txt file to ensure it is valid and concise.

### What it does:
This step detects and fixes the following issues:

#### **Format Errors**
Identifies lines that do not follow the IAB specification:
- **Missing commas**: Separator commas between fields are missing
- **Full-width characters**: Use of full-width commas or spaces
- **Extra whitespace/newlines**: Unnecessary whitespace or line breaks
- **Invalid characters**: Prohibited or control characters
- **Field count mismatch**: Missing or excessive required fields

#### **Duplicate Entries**
Detects duplicate lines with identical content:
- Exact match lines (same domain, account ID, relationship, and certification authority ID)
- Duplicate variable directives (OWNERDOMAIN, MANAGERDOMAIN, etc.)

### Checkpoints:
- ✅ Each line has the correct number of fields in the proper order
- ✅ Comma separators and spelling are correct
- ✅ DIRECT and RESELLER are spelled correctly
- ✅ Account IDs are accurate (matching information provided by partners)

### Recommended Actions:

#### **Handling Invalid Lines**
- **Remove**: Completely delete invalid lines (maintains a clean file)
- **Comment Out**: Add `# INVALID:` prefix to disable lines (useful for auditing or later review)

#### **Handling Duplicate Lines**
- **Remove**: Delete duplicates, keeping only one instance
- **Comment Out**: Add `# DUPLICATE:` prefix to clearly mark duplicates

### Common Error Examples:
```
# Error Example 1: Missing comma
google.com pub-1234567890 DIRECT f08c47fec0942fa0

# Error Example 2: Full-width characters
google.com、pub-1234567890、DIRECT、f08c47fec0942fa0

# Error Example 3: Spelling mistake
google.com, pub-1234567890, DIRRECT, f08c47fec0942fa0
```

---

<a id="step2"></a>

## 2. Check Owner Domain

Adds the OWNERDOMAIN directive to your ads.txt file to explicitly declare the actual owner (business entity) of your site or app.

### What it does:
- Checks if `OWNERDOMAIN={domain}` is present.
- Automatically adds it if missing.
- **Important**: If OWNERDOMAIN is not explicitly specified, the domain where the ads.txt file is hosted (root domain) is treated as the OWNERDOMAIN by default.

### Role of OWNERDOMAIN:
- **Sellers.json Matching**: OWNERDOMAIN is used to match entries in sellers.json files where the seller is listed as PUBLISHER or BOTH.
- **Multi-Domain Consolidation**: If you own multiple domains under the same business entity, you can specify the same OWNERDOMAIN across all domains.
- **Improved Transparency**: Even if the OWNERDOMAIN matches the domain hosting the ads.txt, explicitly declaring it improves supply chain transparency.

### Example:
```
OWNERDOMAIN=example-publisher.com
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
```

---

<a id="step3"></a>

## 3. Verify Manager Domain

Validates MANAGERDOMAIN entries when publishers outsource ad monetization management, and manages them appropriately.

### What it does:
- Detects `MANAGERDOMAIN=` entries.
- Removes or comments out invalid or unnecessary MANAGERDOMAIN entries.

### What is MANAGERDOMAIN:
- **Role**: Indicates the entity managing the publisher's ad monetization (such as sales agencies or sales houses).
- **Usage Conditions**: Should **only be used when the publisher outsources the majority of inventory management** to an external party.
- **Caution**: Avoid using it if only managing some ad formats.

### Regional Management:
- **Global Management**: Specified without country code (e.g., `MANAGERDOMAIN=global-sales.com`)
- **Regional Management**: Add 2-letter ISO country code (e.g., `MANAGERDOMAIN=eu-sales.com, EU`)
- **Restriction**: Setting multiple MANAGERDOMAINs for the same country will result in an error.

### Example:
```
OWNERDOMAIN=example-publisher.com
MANAGERDOMAIN=global-sales.com
MANAGERDOMAIN=eu-sales.com, EU
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
```

### Recommended Action:
- Remove MANAGERDOMAIN if you are not using it or if it is unnecessary.
- Ensure MANAGERDOMAIN is correctly configured to maintain consistency with sellers.json.

---

<a id="step4"></a>

## 4. Relationship Correction

Automatically corrects the relationship field (`DIRECT` / `RESELLER`) in ads.txt entries based on advertising system `sellers.json` data.

### What it does:
This step uses sellers.json data stored in the Ads.txt Manager database to verify relationship validity and automatically correct as needed.

#### **Verification Process**:
1. Extract each entry (domain + account ID) from ads.txt
2. Search for corresponding entry in sellers.json file
3. Check the `seller_type` field in sellers.json
4. Compare with ads.txt relationship field

#### **Auto-correction Rules**:
| sellers.json seller_type | Correct ads.txt Relationship |
|-------------------------|----------------------------|
| `PUBLISHER` | `DIRECT` |
| `BOTH` | `DIRECT` or `RESELLER` |
| `INTERMEDIARY` | `RESELLER` |

### Correction Example:
```
# Before correction (incorrect)
google.com, pub-1234567890, RESELLER, f08c47fec0942fa0

# Check sellers.json
# → seller_type = "PUBLISHER" found

# After correction (correct)
google.com, pub-1234567890, DIRECT, f08c47fec0942fa0
```

### Why it's important:
- **Revenue Impact**: Relationship mismatches can lead to bid exclusion or revenue loss from DSPs (Demand-Side Platforms)
- **Supply Chain Transparency**: Accurate relationship declarations are essential for improving supply chain transparency
- **Avoid Platform Warnings**: Reduces risk of warnings from advertising platforms like Google AdSense

### Important Notes:
- This step uses sellers.json data stored in the Ads.txt Manager database
- If no corresponding sellers.json exists in the database, verification is skipped
- Corrections are only made based on information clearly stated in sellers.json

---

<a id="step5"></a>

## 5. Verify Sellers

Validates that Seller IDs (account IDs) listed in your ads.txt actually exist in the advertising system's `sellers.json` file, and identifies invalid entries.

### What it does:
This step uses sellers.json data stored in the Ads.txt Manager database to verify the validity of ads.txt entries.

#### **Verification Process**:
1. Extract each entry (advertising system domain + account ID) from ads.txt
2. Search for the entry in the Ads.txt Manager sellers_catalog table
3. **If not found**: The seller ID is likely invalid or inactive
4. **If found**: The seller ID is valid (no action taken in this step)

### Causes of Invalid Seller IDs:
- **Closed accounts**: Accounts that were previously used but are now invalid
- **ID typos**: Input errors in IDs provided by partners
- **Outdated information**: Partners updated sellers.json and removed the ID
- **Test accounts**: Test IDs remaining in production environment

### Verification Example:
```
# Entry in ads.txt
appnexus.com, 12345, DIRECT

# Check sellers.json
# → "12345" not found in appnexus.com's sellers.json

# Result: Invalid seller ID
```

### Recommended Actions:

#### **Handling Invalid Entries**
- **Remove**: Completely delete the line if seller ID doesn't exist (recommended)
  - Removing invalid lines keeps the file clean and makes advertising system processing more efficient

- **Comment Out**: Add `# INVALID_SELLER_ID:` prefix to disable the line
  - Useful for maintaining audit trails or records
  - Can serve as reference material when confirming with partners later

### Why it's important:
- **Improved File Credibility**: ads.txt containing only valid sellers gains higher trust from advertising systems
- **Processing Efficiency**: Removing invalid entries makes advertising system crawl processing more efficient
- **Avoid Warnings**: Invalid seller IDs can trigger warnings on some advertising platforms

### Important Notes:
- This step is based on sellers.json data stored in the Ads.txt Manager database
- If no corresponding sellers.json exists in the database, verification is skipped
- We recommend confirming with partners before deleting when seller IDs are not found

---
