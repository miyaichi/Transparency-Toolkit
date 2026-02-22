import axios, { AxiosInstance, AxiosResponse } from 'axios';
import https from 'https';

export interface OpenSinceraConfig {
  baseUrl: string;
  apiKey: string | undefined;
  timeout: number;
}

export interface GetPublisherMetadataRequest {
  publisherId?: string;
  publisherDomain?: string;
  limit?: number;
  offset?: number;
}

export interface PublisherMetadata {
  publisherId: string;
  publisherName: string;
  ownerDomain: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastUpdated: string;
  contactEmail?: string;
  categories: string[];
  verificationStatus: 'verified' | 'unverified' | 'pending';
  parentEntityId?: number;
  similarPublishers?: number[];
  metadata?: {
    description?: string;
    primarySupplyType?: string;
    avgAdsToContentRatio?: number;
    avgAdsInView?: number;
    avgAdRefresh?: number;
    totalUniqueGpids?: number;
    idAbsorptionRate?: number;
    avgPageWeight?: number;
    avgCpu?: number;
    totalSupplyPaths?: number;
    resellerCount?: number;
    slug?: string;
  };
}

export interface GetPublisherMetadataResponse {
  publishers: PublisherMetadata[];
  totalCount: number;
  hasMore: boolean;
  rawResponse?: any;
}

export interface OpenSinceraApiError {
  code: string;
  message: string;
  details?: any;
}

export class OpenSinceraHttpError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export class OpenSinceraService {
  private client: AxiosInstance;
  private config: OpenSinceraConfig;

  constructor(openSinceraConfig: OpenSinceraConfig) {
    this.config = openSinceraConfig;

    if (!this.config.apiKey) {
      throw new Error('OpenSincera API key is required');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiKey!}`,
        'User-Agent': 'Transparency Toolkit/1.0',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: true,
        keepAlive: true,
        timeout: this.config.timeout,
      }),
      validateStatus: (status) => status < 500,
    });

    this.setupInterceptors();
  }

  public buildPublisherUrl(request: GetPublisherMetadataRequest): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}${this.buildPublisherPath(request)}`;
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        // console.log('OpenSincera API request', {
        //   method: config.method,
        //   url: config.url,
        //   params: config.params,
        // });
        return config;
      },
      (error) => {
        console.error('OpenSincera API request error', { error: error.message });
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        // console.log('OpenSincera API response', {
        //   status: response.status,
        //   url: response.config.url,
        // });
        return response;
      },
      (error) => {
        console.error('OpenSincera API response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  async getPublisherMetadata(request: GetPublisherMetadataRequest = {}): Promise<GetPublisherMetadataResponse> {
    try {
      const endpoint = this.buildPublisherPath(request);
      const response: AxiosResponse<any> = await this.client.get(endpoint);

      if (response.status === 200) {
        const responseData = response.data;
        let publisherData: any = null;

        if (Array.isArray(responseData) && responseData.length > 0) {
          publisherData = responseData[0];
        } else if (responseData && typeof responseData === 'object' && responseData.publisher_id) {
          publisherData = responseData;
        }

        if (publisherData) {
          const mappedPublisher: PublisherMetadata = {
            publisherId: publisherData.publisher_id || publisherData.id || '',
            publisherName: publisherData.name || '',
            ownerDomain: publisherData.owner_domain || request.publisherDomain || '',
            domain: publisherData.domain,
            status: this.mapStatus(publisherData.status),
            lastUpdated: publisherData.updated_at || new Date().toISOString(),
            contactEmail: publisherData.contact_email,
            categories: Array.isArray(publisherData.categories)
              ? publisherData.categories
              : publisherData.categories?.split(';') || [],
            verificationStatus: publisherData.visit_enabled ? 'verified' : 'unverified',
            parentEntityId: publisherData.parent_entity_id,
            similarPublishers: publisherData.similar_publishers?.content,
            metadata: {
              description: publisherData.pub_description,
              primarySupplyType: publisherData.primary_supply_type,
              avgAdsToContentRatio: publisherData.avg_ads_to_content_ratio,
              avgAdsInView: publisherData.avg_ads_in_view,
              avgAdRefresh: publisherData.avg_ad_refresh,
              totalUniqueGpids: publisherData.total_unique_gpids,
              idAbsorptionRate: publisherData.id_absorption_rate,
              avgPageWeight: publisherData.avg_page_weight,
              avgCpu: publisherData.avg_cpu,
              totalSupplyPaths: publisherData.total_supply_paths,
              resellerCount: publisherData.reseller_count,
              slug: publisherData.slug,
            },
          };

          return {
            publishers: [mappedPublisher],
            totalCount: 1,
            hasMore: false,
            rawResponse: response.data,
          };
        } else {
          return {
            publishers: [],
            totalCount: 0,
            hasMore: false,
            rawResponse: response.data,
          };
        }
      }

      if (response.status === 401) {
        throw new OpenSinceraHttpError('Invalid API key or authentication failed', response.status, response.data);
      }

      if (response.status === 403) {
        throw new OpenSinceraHttpError('Access forbidden - insufficient permissions', response.status, response.data);
      }

      if (response.status === 404) {
        throw new OpenSinceraHttpError('Publisher not found', response.status, response.data);
      }

      if (response.status === 429) {
        throw new OpenSinceraHttpError('Rate limit exceeded - please try again later', response.status, response.data);
      }

      throw new OpenSinceraHttpError(
        `API request failed with status ${response.status}: ${response.statusText}`,
        response.status,
        response.data,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get publisher metadata', {
        error: errorMessage,
        request,
      });

      if (axios.isAxiosError(error) && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
        console.error('OpenSincera API network error - check endpoint URL and connectivity', {
          domain: request.publisherDomain,
          publisherId: request.publisherId,
          baseUrl: this.config.baseUrl,
          errorCode: error.code,
        });
      }

      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          const apiError = error.response.data.error as OpenSinceraApiError;
          throw new OpenSinceraHttpError(
            `OpenSincera API Error: ${apiError.message} (${apiError.code})`,
            error.response.status,
            error.response.data,
          );
        }
        throw new OpenSinceraHttpError(
          `HTTP ${error.response?.status}: ${error.response?.statusText || errorMessage}`,
          error.response?.status,
          error.response?.data,
        );
      }

      throw error;
    }
  }

  private buildPublisherPath(request: GetPublisherMetadataRequest): string {
    if (request.publisherId) {
      return `/publishers?id=${encodeURIComponent(request.publisherId)}`;
    }
    if (request.publisherDomain) {
      return `/publishers?domain=${encodeURIComponent(request.publisherDomain)}`;
    }
    throw new Error('Either publisherId or publisherDomain is required');
  }

  private mapStatus(sinceraStatus: any): 'active' | 'inactive' | 'suspended' {
    if (typeof sinceraStatus === 'string') {
      const status = sinceraStatus.toLowerCase();
      if (status.includes('active') || status === 'live') {
        return 'active';
      } else if (status.includes('suspend')) {
        return 'suspended';
      }
    }
    return 'inactive';
  }

  async getPublisherByDomain(domain: string): Promise<PublisherMetadata | null> {
    try {
      const response = await this.getPublisherMetadata({ publisherDomain: domain, limit: 1 });
      return response.publishers.length > 0 ? response.publishers[0] : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get publisher by domain', { domain, error: errorMessage });
      throw error;
    }
  }

  async getPublisherById(publisherId: string): Promise<PublisherMetadata | null> {
    try {
      const response = await this.getPublisherMetadata({ publisherId, limit: 1 });
      return response.publishers.length > 0 ? response.publishers[0] : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get publisher by ID', { publisherId, error: errorMessage });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/publishers?domain=google.com', {
        timeout: 5000,
      });

      return response.status < 500;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (axios.isAxiosError(error) && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
        console.error('OpenSincera API not reachable', {
          error: errorMessage,
          baseUrl: this.config.baseUrl,
        });
        return false;
      }

      console.error('OpenSincera API health check encountered error but API appears reachable', {
        error: errorMessage,
        baseUrl: this.config.baseUrl,
      });
      return true;
    }
  }
}
