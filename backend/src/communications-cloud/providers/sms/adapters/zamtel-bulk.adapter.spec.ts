import { ZamtelBulkSmsAdapter } from './zamtel-bulk.adapter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZamtelBulkSmsAdapter (v3 API)', () => {
  let adapter: ZamtelBulkSmsAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ZamtelBulkSmsAdapter({ apiKey: 'KEY123', senderId: 'SMARTTECH' });
  });

  it('reads the SMS credit balance from GET /v3/sms/balance with Bearer auth', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { success: true, sms_balance: 972, statusCode: 200 },
    } as any);

    const balance = await adapter.getBalance();
    expect(balance.balance).toBe(972);
    expect(balance.currency).toBe('ZMW');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/v3\/sms\/balance$/),
      expect.objectContaining({ headers: { Authorization: 'Bearer KEY123' } }),
    );
  });

  it('sends via POST /v3/action/send with JSON body and Bearer auth', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 202,
      data: { success: true, responseText: 'SMS(es) have been queued for delivery', statusCode: 202, request_id: 'R-1' },
    } as any);

    const result = await adapter.send({ to: '+260970000001', body: 'Hello' });
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('R-1');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/v3\/action\/send$/),
      { sender_id: 'SMARTTECH', contacts: '260970000001', message: 'Hello' },
      expect.objectContaining({
        headers: { Authorization: 'Bearer KEY123', 'Content-Type': 'application/json' },
      }),
    );
  });

  it('reports non-2xx/error responses as failed with the provider message', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { success: false, responseText: 'Invalid api_key', statusCode: 422 },
    } as any);

    const result = await adapter.send({ to: '+260970000001', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid api_key/i);
  });

  it('surfaces transport/auth errors instead of pretending success', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 422, data: { message: 'Invalid api_key', errors: { responseText: 'Invalid api_key' } } },
    } as any);

    const result = await adapter.send({ to: '+260970000001', body: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid api_key/i);
  });

  it('normalises local-to-international numbers for the contacts field', async () => {
    mockedAxios.post.mockResolvedValue({ status: 202, data: { success: true, statusCode: 202 } } as any);

    await adapter.send({ to: '0979551234', body: 'Hi' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ contacts: '260979551234' }),
      expect.any(Object),
    );
  });
});