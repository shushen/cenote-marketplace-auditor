import axios from 'axios';
import { MarketplaceHttpClient } from '../MarketplaceHttpClient.js';
import { MarketplaceApiError } from '../MarketplaceApiError.js';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MarketplaceHttpClient', () => {
    let client: MarketplaceHttpClient;

    beforeEach(() => {
        client = new MarketplaceHttpClient();
        mockedAxios.request.mockReset();
    });

    it('returns JSON for successful GET', async () => {
        mockedAxios.request.mockResolvedValue({
            status: 200,
            data: { developerId: 'dev-1' },
            headers: {},
        });

        const result = await client.get<{ developerId: string }>(
            'https://api.atlassian.com/marketplace/rest/3/reporting/developer-space/dev-1/quotes',
            { headers: { Authorization: 'Basic abc' } }
        );

        expect(result).toEqual({ developerId: 'dev-1' });
        expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    });

    it('retries GET on 429 and eventually succeeds', async () => {
        mockedAxios.request
            .mockResolvedValueOnce({
                status: 429,
                data: { message: 'Rate limited' },
                headers: { 'retry-after': '0' },
            })
            .mockResolvedValueOnce({
                status: 200,
                data: { ok: true },
                headers: {},
            });

        const result = await client.get<{ ok: boolean }>(
            'https://api.atlassian.com/marketplace/rest/3/reporting/developer-space/dev-1/quotes/details',
            { headers: { Authorization: 'Basic abc' } }
        );

        expect(result).toEqual({ ok: true });
        expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('throws MarketplaceApiError when retries are exhausted', async () => {
        mockedAxios.request.mockResolvedValue({
            status: 429,
            data: { message: 'Rate limited' },
            headers: { 'retry-after': '0' },
        });

        await expect(
            client.get(
                'https://api.atlassian.com/marketplace/rest/3/reporting/developer-space/dev-1/quotes/details',
                {
                    headers: { Authorization: 'Basic abc' },
                    context: 'Fetch quote details (QT-1)',
                }
            )
        ).rejects.toBeInstanceOf(MarketplaceApiError);
    });
});
