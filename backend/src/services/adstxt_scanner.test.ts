import { query } from '../db/client';
import client from '../lib/http';
import { AdsTxtScanner } from './adstxt_scanner';

jest.mock('../lib/http');
jest.mock('../db/client');

// Mock client.get to return a Promise
const mockedClient = client as unknown as { get: jest.Mock };
const mockedQuery = query as jest.Mock;

describe('AdsTxtScanner', () => {
  let scanner: AdsTxtScanner;

  beforeEach(() => {
    scanner = new AdsTxtScanner();
    jest.clearAllMocks();
  });

  it('should scan normal root domain without checking root authorization', async () => {
    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-000, DIRECT, f08c47fec0942fa0',
      status: 200,
    });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] }); // insert success

    await scanner.scanAndSave('example.com');

    // Should only fetch example.com/ads.txt
    expect(mockedClient.get).toHaveBeenCalledTimes(1);
    expect(mockedClient.get).toHaveBeenCalledWith('https://example.com/ads.txt', expect.any(Object));
  });

  it('should validate subdomain against root domain ads.txt', async () => {
    // 1. Subdomain fetch (sub.example.com/ads.txt)
    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-111, DIRECT, f08c47fec0942fa0',
      status: 200,
    });
    // 2. Root domain fetch (example.com/ads.txt)
    mockedClient.get.mockResolvedValueOnce({
      data: 'subdomain=sub.example.com',
      status: 200,
    });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

    await scanner.scanAndSave('sub.example.com');

    expect(mockedClient.get).toHaveBeenNthCalledWith(1, 'https://sub.example.com/ads.txt', expect.any(Object));
    expect(mockedClient.get).toHaveBeenNthCalledWith(2, 'https://example.com/ads.txt', expect.any(Object));
  });

  it('should fail if subdomain is not authorized in root ads.txt', async () => {
    // 1. Subdomain fetch
    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-111, DIRECT, f08c47fec0942fa0',
      status: 200,
    });
    // 2. Root domain fetch
    mockedClient.get.mockResolvedValueOnce({
      data: 'subdomain=other.example.com', // authorizes other, not sub
      status: 200,
    });

    // Should save error
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '2' }] });

    await scanner.scanAndSave('sub.example.com');

    // Should fetch subdomain then root
    expect(mockedClient.get).toHaveBeenCalledTimes(2);
    expect(mockedClient.get).toHaveBeenNthCalledWith(1, 'https://sub.example.com/ads.txt', expect.any(Object));
    expect(mockedClient.get).toHaveBeenNthCalledWith(2, 'https://example.com/ads.txt', expect.any(Object));

    // Verify error saved
    // The query arguments are complex sql strings, so we check params
    const callArgs = mockedQuery.mock.calls[0];
    const sql = callArgs[0];
    const params = callArgs[1];

    expect(sql).toContain('INSERT INTO ads_txt_scans');
    // params: [domain, url, content, status_code, errorMessage, records_count, valid_count, warning_count, NOW(), file_type]
    expect(params[0]).toBe('sub.example.com');
    expect(params[4]).toContain('not authorized');
  });

  it('should case-insensitive match subdomain', async () => {
    // 1. Subdomain fetch (sub.example.com/ads.txt)
    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-111, DIRECT, f08c47fec0942fa0',
      status: 200,
    });
    // 2. Root domain fetch (example.com/ads.txt)
    mockedClient.get.mockResolvedValueOnce({
      data: 'subdomain=SUB.example.com',
      status: 200,
    });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

    await scanner.scanAndSave('sub.example.com');

    expect(mockedClient.get).toHaveBeenCalledTimes(2);
  });

  it('should skip validation for app-ads.txt', async () => {
    // 1. Subdomain fetch (sub.example.com/app-ads.txt)
    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-111, DIRECT, f08c47fec0942fa0',
      status: 200,
    });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

    // Calling with app-ads.txt
    await scanner.scanAndSave('sub.example.com', 'app-ads.txt');

    // Should NOT fetch root domain ads.txt
    expect(mockedClient.get).toHaveBeenCalledTimes(1);
    expect(mockedClient.get).toHaveBeenCalledWith('https://sub.example.com/app-ads.txt', expect.any(Object));
  });

  it('should allow redirect from root to its own subdomain without SUBDOMAIN validation', async () => {
    // User requests 'example.com'
    // Redirects to 'www.example.com'
    // This is valid authoritative source for root, should not trigger subdomain check.

    mockedClient.get.mockResolvedValueOnce({
      data: 'google.com, pub-111, DIRECT, f08c47fec0942fa0',
      status: 200,
      request: {
        res: {
          responseUrl: 'https://www.example.com/ads.txt',
        },
      },
    });

    mockedQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

    await scanner.scanAndSave('example.com'); // input is root

    // Should NOT fetch root domain validation (e.g. example.com/ads.txt a second time)
    expect(mockedClient.get).toHaveBeenCalledTimes(1);
    expect(mockedClient.get).toHaveBeenCalledWith('https://example.com/ads.txt', expect.any(Object));
  });
});
