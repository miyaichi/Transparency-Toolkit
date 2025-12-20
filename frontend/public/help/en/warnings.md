# Ads.txt Validation Warning Guide

This document describes all validation warnings and errors that may appear in the AdsTxt Manager. Each warning includes an explanation of the issue and recommendations on how to fix it.

## File Access Errors

<a id="file-not-found"></a>

### File Not Found (Code: 10010)

**Description**: The registered ads.txt or app-ads.txt file does not exist.

**Recommendation**: Create an ads.txt file at your domain root (domain.com/ads.txt) or app-ads.txt file at developerurl.com/app-ads.txt.

---

<a id="invalid-content-type"></a>

### Invalid Content Type (Code: 10020)

**Description**: The file is not provided with the HTTP request header "Content-Type: text/plain".

**Recommendation**: Configure your server to return the file with Content-Type: text/plain. It is also advisable to use "Content-Type: text/plain; charset=utf-8" to explicitly signal UTF8 support.

---

<a id="timeout"></a>

### Timeout (Code: 10030)

**Description**: The crawler experienced a timeout while attempting to access your ads.txt or app-ads.txt file.

**Recommendation**: Check your server's response time and ensure the file can be retrieved within 20 seconds.

---

<a id="too-many-redirects"></a>

### Redirect Limit Exceeded (Code: 10040, 10050)

**Description**: The access to your file exceeds the redirect limit.

**Recommendation**: Limit redirects to a maximum of 5 within the root domain and a maximum of 1 outside the root domain.

---

## Invalid Format Errors

<a id="invalid-format"></a>

### Invalid Format

**Description**: The format of the Ads.txt entry is invalid and could not be parsed correctly. Ads.txt entries must follow a specific comma-separated format.

**Recommendation**: Ensure the entry follows the format `domain.com, account_id, DIRECT|RESELLER, certification_authority_id`. The certification authority ID is optional.

---

<a id="missing-fields"></a>

### Missing Required Fields (Code: 11010)

**Description**: The ads.txt entry is missing the three required fields. Each entry must contain at least two commas and include the advertising system domain, account ID, and account type (DIRECT or RESELLER).

**Recommendation**: Make sure your entry includes all required fields in the format `domain.com, account_id, DIRECT|RESELLER, certification_authority_id`.

---

<a id="no-valid-entries"></a>

### No Valid Entries (Code: 11040)

**Description**: No valid entries were found in your ads.txt file. As of March 2020, empty files are no longer accepted as a way to declare no authorized digital sellers.

**Recommendation**: If you have no authorized digital sellers, use a placeholder entry such as `placeholder.example.com, placeholder, DIRECT, placeholder`.

---

<a id="whitespace-in-fields"></a>

### Whitespace in Fields (Code: 11050)

**Description**: Fields contain tabs, commas, or whitespace.

**Recommendation**: Fields should not contain tabs, commas, or whitespace; otherwise, they should be escaped with URL encoding.

---

## Relationship Warnings

<a id="invalid-relationship"></a>

### Invalid Relationship (Code: 11020)

**Description**: The third required field must contain either "DIRECT" or "RESELLER". A value of 'DIRECT' indicates that the Publisher (content owner) directly controls the account indicated in field #2 on the system in field #1. This tends to mean a direct business contract between the Publisher and the advertising system. A value of 'RESELLER' indicates that the Publisher has authorized another entity to control the account indicated in field #2 and resell their ad space via the system in field #1.

**Recommendation**: Change the relationship type to either DIRECT or RESELLER.

---

## Domain Warnings

<a id="invalid-domain"></a>

### Invalid Domain (Code: 11030)

**Description**: The advertising system domain is not a valid domain. The identifiers in field #1 are assumed to be valid DNS domain names obeying RFC 1123.

**Recommendation**: Ensure that the domain name of the advertising system is a valid domain.

---

<a id="empty-account-id"></a>

### Empty Account ID

**Description**: The account ID field is empty. Every ads.txt entry must include an account ID.

**Recommendation**: Provide a valid account ID, which should be the publisher's ID in the advertising system's platform.

---

## Implemented Entry Information

<a id="implimented-entry"></a>

### Implemented Entry

**Description**: An identical entry already exists in the ads.txt file for the specified domain.

**Recommendation**: You do not need to include the implemented entry in the new entry. The existing entry is already valid and does not need to be duplicated.

---

## Sellers.json Validation Warnings

<a id="no-sellers-json"></a>

### No Sellers.json File (Code: 12010, 13010)

**Description**: No sellers.json file was found for the advertising system domain listed for this DIRECT/RESELLER entry at http://{advertising_system_domain}/sellers.json.

**Recommendation**: Contact your selling partner to ask them to implement sellers.json. This is an informational warning, and you can continue with the entry, but cross-validation with sellers.json is not possible.

---

<a id="direct-account-id-not-in-sellers-json"></a>

### DIRECT: Account ID Not in Sellers.json (Code: 12020)

**Description**: The advertising system you have listed does not have your publisher account ID listed as a seller_id in their sellers.json files.

**Recommendation**: Remove this entry from your file if you no longer work with the seller. Verify the account ID is correct, and if the relationship is truly DIRECT, the advertising system should include your publisher ID in their sellers.json file.

---

<a id="reseller-account-id-not-in-sellers-json"></a>

### RESELLER: Account ID Not in Sellers.json (Code: 13020)

**Description**: The advertising system you have listed does not have your publisher account ID listed as a seller_id in their sellers.json files.

**Recommendation**: Remove this entry from your file if you no longer work with the seller. Verify the account ID is correct, and if you're using a reseller, their ID should be included in the advertising system's sellers.json file.

---

<a id="domain-mismatch"></a>

### Domain Mismatch (Code: 12030, 13030)

**Description**: This is the business domain listed with the specified account ID.

**Recommendation**: Please confirm that you are listed as expected. If a domain is present, it should be the business domain name of the company (the legal entity) that is paid for inventory that is transacted under the given seller_id.

---

<a id="direct-not-publisher"></a>

### DIRECT: Seller Not Marked as PUBLISHER (Code: 12040, 12050)

**Description**: I) This seller ID is listed as BOTH, meaning you act as both a PUBLISHER and INTERMEDIARY with this seller.
II) This seller has listed your relationship as an INTERMEDIARY, while there are valid use cases for this relationship.

**Recommendation**: If this is incorrect, please work with your selling partner to make sure your files display the correct relationship.

---

<a id="seller-id-not-unique"></a>

### Seller ID Not Unique (Code: 12060, 13060)

**Description**: This seller_id is used multiple times in the advertising system's sellers.json file. This is invalid per the specification.

**Recommendation**: Review the other selling partners using this ID and contact your selling partner to better understand how your inventory is being sold.

---

<a id="reseller-not-intermediary"></a>

### RESELLER: Seller Not Marked as INTERMEDIARY (Code: 13040, 13050)

**Description**: I) This seller ID is listed as BOTH, meaning it acts as both a PUBLISHER and INTERMEDIARY.
II) This seller has listed your relationship as a PUBLISHER, which differs from the RESELLER relationship that you have listed.

**Recommendation**: If this is incorrect, please work with your selling partner to make sure your files display the correct relationship.

---

<a id="sellers-json-validation-error"></a>

### Sellers.json Validation Error

**Description**: An error occurred while validating against the advertising system's sellers.json file.

**Recommendation**: This is usually a temporary or technical error. You can proceed with the entry, but be aware that full validation against sellers.json was not possible. Consider retrying later.

---

## Subdomain Validation Warnings

<a id="invalid-subdomain-url"></a>

### Invalid Subdomain URL (Code: 14020)

**Description**: The subdomain listed is not a valid URL.

**Recommendation**: Ensure the subdomain is a valid URL.

---

<a id="invalid-subdomain"></a>

### Invalid Subdomain (Code: 14030)

**Description**: The subdomain listed is not a subdomain of the root domain of the ads.txt file.

**Recommendation**: Ensure the subdomain is a subdomain of the root domain where the ads.txt file was found.

---

<a id="invalid-subdomain-ads-txt"></a>

### Invalid Subdomain Ads.txt (Code: 14040)

**Description**: The subdomain does not have a valid ads.txt file.

**Recommendation**: Ensure there is a valid ads.txt file listed at subdomain.domain.com/ads.txt for the subdomain.

---

<a id="subdomain-not-listed"></a>

### Subdomain Not Listed (Code: 14050)

**Description**: The subdomain is not listed in the root domain's ads.txt file as subdomain=.

**Recommendation**: Only subdomains that are listed in the root domain's ads.txt file using subdomain= should be crawled.

---

<a id="subdomain-contains-subdomains"></a>

### Subdomain Contains Subdomains (Code: 14060)

**Description**: Subdomains cannot contain any other subdomains.

**Recommendation**: Do not include further subdomain= listings in the ads.txt file of a subdomain.

---

## Inventory Partner Domain Validation Warnings

<a id="invalid-inventory-partner-domain"></a>

### Invalid Inventory Partner Domain (Code: 15020)

**Description**: The domain listed in "inventorypartnerdomain=programmerA.com" does not have a valid ads.txt file.

**Recommendation**: Ensure there is a valid ads.txt file at programmerA.com/ads.txt.

---

<a id="inventory-partner-contains-partners"></a>

### Inventory Partner Contains Partners (Code: 15030)

**Description**: Only "one hop" is allowed, so the inventory partner should not list inventory partners.

**Recommendation**: Ensure the inventory partner's ads.txt file does not contain inventory partner domain listings.

---

## Manager Domain Validation Warnings

<a id="invalid-manager-domain"></a>

### Invalid Manager Domain (Code: 16010)

**Description**: The domain provided for managerdomain= was invalid.

**Recommendation**: Ensure that in managerdomain=domain.com, domain.com is a valid URL.

---

<a id="multiple-manager-domains-without-country"></a>

### Multiple Manager Domains Without Country (Code: 16020)

**Description**: More than one managerdomain is only valid if an ISO 3166-1 alpha-2 country code is provided.

**Recommendation**: If there is more than one managerdomain=, each listing must be associated with a country code in the following format: Syntax of the domain is [PSL+1 domain, required], [ISO 3166-1 alpha-2 country code, optional, blank=global].

---

<a id="invalid-country-code"></a>

### Invalid Country Code (Code: 16030)

**Description**: The Country Code provided is not a valid ISO 3166-1 alpha-2 country code.

**Recommendation**: Syntax of the domain is [PSL+1 domain, required], [ISO 3166-1 alpha-2 country code, optional, blank=global].

---

<a id="manager-without-sellers-json"></a>

### Manager Without Sellers.json (Code: 16040)

**Description**: The managerdomain= provided does not have a valid sellers.json file.

**Recommendation**: Ensure the domain listed in managerdomain=domain.com has a valid sellers.json file at domain.com/sellers.json.

---

<a id="manager-without-entry"></a>

### Manager Without Entry (Code: 16050)

**Description**: The ads.txt file should also have an Authorized Seller entry that lists the managerdomain as an advertising system.

**Recommendation**: managerdomain=domain.com should also have an authorized seller entry such as domain.com, ID, RELATIONSHIP.

---

<a id="manager-not-direct"></a>

### Manager Not DIRECT (Code: 16060)

**Description**: The authorized seller entry for a managerdomain should be listed as a DIRECT relationship.

**Recommendation**: managerdomain=domain.com should also have an authorized seller entry such as domain.com, ID, DIRECT.

---

<a id="manager-sellers-json-without-id"></a>

### Manager Sellers.json Without ID (Code: 16070)

**Description**: domain.com/sellers.json does not have an advertising system ID that matches the entry from website.com's ads.txt file.

**Recommendation**: With managerdomain=domain.com, domain.com/sellers.json should have an entry that uses the ID from the authorized seller entry for domain.com on the website's ads.txt file.

---

<a id="manager-sellers-json-domain-mismatch"></a>

### Manager Sellers.json Domain Mismatch (Code: 16080)

**Description**: domain.com/sellers.json has a listing for advertising system ID, but the seller domain does not match website.com's ads.txt file.

**Recommendation**: With managerdomain=domain.com, the seller domain entry in domain.com/sellers.json should match the domain found in ownerdomain=, or if no ownerdomain= is present, it should match the domain on which the ads.txt file was found.

---

<a id="manager-sellers-json-not-publisher"></a>

### Manager Sellers.json Not PUBLISHER (Code: 16090)

**Description**: domain.com/sellers.json has a listing for advertising system ID that matches the entry from website.com's ads.txt file, but the relationship is not listed as PUBLISHER.

**Recommendation**: With managerdomain=domain.com, the relationship type in domain.com/sellers.json should be PUBLISHER.

---

## Owner Domain Validation Warnings

<a id="invalid-owner-domain"></a>

### Invalid Owner Domain (Code: 17010)

**Description**: The domain provided for ownerdomain= was invalid.

**Recommendation**: Ensure that in ownerdomain=domain.com, domain.com is a valid URL.

---

<a id="multiple-owner-domains"></a>

### Multiple Owner Domains (Code: 17020)

**Description**: Having more than one ownerdomain listed is considered invalid.

**Recommendation**: You may only have one ownerdomain listed.

---

<a id="owner-domain-mismatch"></a>

### Owner Domain Mismatch (Code: 17030)

**Description**: Ownerdomain should match the business domain listed with the specified account ID.

**Recommendation**: If the publisher lists ownerdomain=, the domain listed should be used in the sellers.json business domain listings for all PUBLISHER entries.
