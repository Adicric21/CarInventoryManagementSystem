import type {
  AuthSession,
  CreateVehicleInput,
  DashboardData,
  DashboardPeriod,
  InventoryActivity,
  InventoryActivityPage,
  InventoryActivityQuery,
  LoginInput,
  LowStockVehicleQuery,
  PaginationMeta,
  Purchase,
  PurchasePage,
  PurchaseQuery,
  RegistrationInput,
  UpdateVehicleInput,
  User,
  Vehicle,
  VehicleCsvError,
  VehicleCsvPreview,
  VehicleCsvRow,
  VehiclePage,
  VehicleSearchQuery,
} from './types.js';
import { clearStoredSession, readStoredAccessToken } from '../auth/session-storage.js';

export { SESSION_STORAGE_KEY } from '../auth/session-storage.js';
export const UNAUTHORIZED_EVENT = 'car-dealership:unauthorized';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const runtimeEnvironment: unknown = import.meta.env;
const configuredApiBaseUrl =
  isRecord(runtimeEnvironment) && typeof runtimeEnvironment.VITE_API_BASE_URL === 'string'
    ? runtimeEnvironment.VITE_API_BASE_URL
    : '/api';
const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    (value.role === 'USER' || value.role === 'ADMIN')
  );
}

function isVehicle(value: unknown): value is Vehicle {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.make === 'string' &&
    typeof value.model === 'string' &&
    typeof value.category === 'string' &&
    typeof value.price === 'number' &&
    typeof value.quantity === 'number' &&
    (value.stockStatus === 'OUT_OF_STOCK' ||
      value.stockStatus === 'LOW_STOCK' ||
      value.stockStatus === 'IN_STOCK') &&
    typeof value.isLowStock === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isPaginationMeta(value: unknown): value is PaginationMeta {
  return (
    isRecord(value) &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.total === 'number' &&
    typeof value.totalPages === 'number'
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isInventoryActivity(value: unknown): value is InventoryActivity {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    [
      'VEHICLE_CREATED',
      'VEHICLE_UPDATED',
      'VEHICLE_DELETED',
      'VEHICLE_PURCHASED',
      'VEHICLE_RESTOCKED',
    ].includes(String(value.action)) &&
    (value.vehicleId === null || typeof value.vehicleId === 'string') &&
    typeof value.vehicleMake === 'string' &&
    typeof value.vehicleModel === 'string' &&
    typeof value.vehicleCategory === 'string' &&
    isNullableNumber(value.quantityBefore) &&
    isNullableNumber(value.quantityChange) &&
    isNullableNumber(value.quantityAfter) &&
    isRecord(value.performedBy) &&
    typeof value.performedBy.id === 'string' &&
    typeof value.performedBy.name === 'string' &&
    typeof value.performedBy.email === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isPurchase(value: unknown): value is Purchase {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.vehicleId === null || typeof value.vehicleId === 'string') &&
    typeof value.vehicleMake === 'string' &&
    typeof value.vehicleModel === 'string' &&
    typeof value.vehicleCategory === 'string' &&
    typeof value.unitPrice === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.totalAmount === 'string' &&
    typeof value.purchasedAt === 'string' &&
    isRecord(value.purchasedBy) &&
    typeof value.purchasedBy.id === 'string' &&
    typeof value.purchasedBy.name === 'string' &&
    typeof value.purchasedBy.email === 'string'
  );
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!isRecord(value) || !isRecord(value.summary)) {
    return false;
  }
  const summary = value.summary;
  const numericFields = [
    'vehicleCount',
    'totalStockUnits',
    'lowStockCount',
    'outOfStockCount',
    'purchaseCount',
    'unitsPurchased',
  ];
  return (
    numericFields.every((field) => typeof summary[field] === 'number') &&
    typeof summary.inventoryValue === 'string' &&
    typeof summary.purchaseRevenue === 'string' &&
    Array.isArray(value.vehiclesByCategory) &&
    value.vehiclesByCategory.every(
      (item) =>
        isRecord(item) &&
        typeof item.category === 'string' &&
        typeof item.vehicleCount === 'number' &&
        typeof item.stockUnits === 'number',
    ) &&
    Array.isArray(value.purchasesByDay) &&
    value.purchasesByDay.every(
      (item) =>
        isRecord(item) &&
        typeof item.date === 'string' &&
        typeof item.purchaseCount === 'number' &&
        typeof item.unitsPurchased === 'number' &&
        typeof item.revenue === 'string',
    ) &&
    Array.isArray(value.topPurchasedVehicles) &&
    value.topPurchasedVehicles.every(
      (item) =>
        isRecord(item) &&
        typeof item.vehicleMake === 'string' &&
        typeof item.vehicleModel === 'string' &&
        typeof item.unitsPurchased === 'number' &&
        typeof item.revenue === 'string',
    ) &&
    Array.isArray(value.recentActivities) &&
    value.recentActivities.every(isInventoryActivity)
  );
}

function invalidResponseError(): ApiError {
  return new ApiError('The server returned an invalid response.', 500, 'INVALID_RESPONSE');
}

function sanitizedUser(user: User): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function invalidateStoredSession(accessToken: string): void {
  if (clearStoredSession(accessToken)) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

async function responseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type');
  if (response.status === 204 || contentType?.includes('application/json') !== true) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function errorFromResponse(status: number, body: unknown): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const code = typeof body.error.code === 'string' ? body.error.code : 'REQUEST_FAILED';
    const message =
      typeof body.error.message === 'string' && body.error.message.trim() !== ''
        ? body.error.message
        : 'The request could not be completed.';
    return new ApiError(message, status, code);
  }

  return new ApiError('The request could not be completed.', status, 'REQUEST_FAILED');
}

function userFromRegistrationResponse(body: unknown): User {
  if (isRecord(body) && isRecord(body.data) && isUser(body.data.user)) {
    return sanitizedUser(body.data.user);
  }

  throw invalidResponseError();
}

function sessionFromLoginResponse(body: unknown): AuthSession {
  if (
    isRecord(body) &&
    isRecord(body.data) &&
    typeof body.data.accessToken === 'string' &&
    body.data.accessToken !== '' &&
    isUser(body.data.user)
  ) {
    return { accessToken: body.data.accessToken, user: sanitizedUser(body.data.user) };
  }

  throw invalidResponseError();
}

function vehicleFromResponse(body: unknown, nested: boolean): Vehicle {
  if (!isRecord(body) || !isRecord(body.data)) {
    throw invalidResponseError();
  }

  const candidate = nested ? body.data.vehicle : body.data;
  if (!isVehicle(candidate)) {
    throw invalidResponseError();
  }

  return candidate;
}

function pageFromResponse(body: unknown): VehiclePage {
  if (
    isRecord(body) &&
    Array.isArray(body.data) &&
    body.data.every(isVehicle) &&
    isPaginationMeta(body.meta)
  ) {
    return { data: body.data, meta: body.meta };
  }

  throw invalidResponseError();
}

function inventoryActivityPageFromResponse(body: unknown): InventoryActivityPage {
  if (
    isRecord(body) &&
    Array.isArray(body.data) &&
    body.data.every(isInventoryActivity) &&
    isPaginationMeta(body.meta)
  ) {
    return { data: body.data, meta: body.meta };
  }

  throw invalidResponseError();
}

function purchasePageFromResponse(body: unknown): PurchasePage {
  if (
    isRecord(body) &&
    Array.isArray(body.data) &&
    body.data.every(isPurchase) &&
    isPaginationMeta(body.meta)
  ) {
    return { data: body.data, meta: body.meta };
  }

  throw invalidResponseError();
}

function dashboardFromResponse(body: unknown): DashboardData {
  if (isRecord(body) && isDashboardData(body.data)) {
    return body.data;
  }
  throw invalidResponseError();
}

function isVehicleCsvRows(value: unknown): value is VehicleCsvRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row: unknown) =>
        isRecord(row) &&
        typeof row.row === 'number' &&
        typeof row.make === 'string' &&
        typeof row.model === 'string' &&
        typeof row.category === 'string' &&
        typeof row.price === 'string' &&
        typeof row.quantity === 'number',
    )
  );
}

function isVehicleCsvErrors(value: unknown): value is VehicleCsvError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (error: unknown) =>
        isRecord(error) &&
        typeof error.row === 'number' &&
        typeof error.field === 'string' &&
        typeof error.code === 'string' &&
        typeof error.message === 'string',
    )
  );
}

function vehicleCsvPreviewFromResponse(body: unknown): VehicleCsvPreview {
  if (
    isRecord(body) &&
    isRecord(body.data) &&
    Array.isArray(body.data.headers) &&
    body.data.headers.every((header) => typeof header === 'string') &&
    typeof body.data.totalRows === 'number' &&
    typeof body.data.validRows === 'number' &&
    typeof body.data.invalidRows === 'number' &&
    isVehicleCsvRows(body.data.rows) &&
    isVehicleCsvErrors(body.data.errors)
  ) {
    return {
      headers: body.data.headers,
      totalRows: body.data.totalRows,
      validRows: body.data.validRows,
      invalidRows: body.data.invalidRows,
      rows: body.data.rows,
      errors: body.data.errors,
    };
  }
  throw invalidResponseError();
}

function queryString(query: VehicleSearchQuery): string {
  const parameters = new URLSearchParams();
  const supportedEntries: [
    keyof VehicleSearchQuery,
    VehicleSearchQuery[keyof VehicleSearchQuery],
  ][] = [
    ['make', query.make?.trim()],
    ['model', query.model?.trim()],
    ['category', query.category?.trim()],
    ['minPrice', query.minPrice],
    ['maxPrice', query.maxPrice],
    ['inStock', query.inStock],
    ['page', query.page],
    ['limit', query.limit],
    ['sortBy', query.sortBy],
    ['sortOrder', query.sortOrder],
  ];

  for (const [key, value] of supportedEntries) {
    if (value !== undefined && value !== '') {
      parameters.set(key, String(value));
    }
  }

  const serialized = parameters.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

function inventoryActivityQueryString(query: InventoryActivityQuery): string {
  const parameters = new URLSearchParams();
  const entries = Object.entries(query);

  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') {
      parameters.set(key, String(value));
    }
  }

  const serialized = parameters.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

function purchaseQueryString(query: PurchaseQuery): string {
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      parameters.set(key, String(value));
    }
  }

  const serialized = parameters.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

class ApiClient {
  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { accessToken: token, sessionInvalidated } = readStoredAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (sessionInvalidated) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    if (typeof init.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    if (token !== null) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      const body = await responseBody(response);
      if (response.status === 401 && token !== null) {
        invalidateStoredSession(token);
      }

      throw errorFromResponse(response.status, body);
    }

    return response;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    return responseBody(await this.authorizedFetch(path, init));
  }

  async register(input: RegistrationInput): Promise<User> {
    const body = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    });
    return userFromRegistrationResponse(body);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const body = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    });
    return sessionFromLoginResponse(body);
  }

  async listVehicles(query: Pick<VehicleSearchQuery, 'page' | 'limit'> = {}): Promise<VehiclePage> {
    return pageFromResponse(await this.request(`/vehicles${queryString(query)}`));
  }

  async searchVehicles(query: VehicleSearchQuery = {}): Promise<VehiclePage> {
    return pageFromResponse(await this.request(`/vehicles/search${queryString(query)}`));
  }

  async createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    const body = await this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return vehicleFromResponse(body, true);
  }

  async updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const body = await this.request(`/vehicles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return vehicleFromResponse(body, true);
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.request(`/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async purchaseVehicle(id: string, quantity: number): Promise<Vehicle> {
    const body = await this.request(`/vehicles/${encodeURIComponent(id)}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    });
    return vehicleFromResponse(body, false);
  }

  async restockVehicle(id: string, quantity: number): Promise<Vehicle> {
    const body = await this.request(`/vehicles/${encodeURIComponent(id)}/restock`, {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    });
    return vehicleFromResponse(body, false);
  }

  async getLowStockVehicles(query: LowStockVehicleQuery = {}): Promise<VehiclePage> {
    return pageFromResponse(await this.request(`/admin/vehicles/low-stock${queryString(query)}`));
  }

  async getInventoryActivities(query: InventoryActivityQuery = {}): Promise<InventoryActivityPage> {
    const body = await this.request(
      `/admin/inventory/activities${inventoryActivityQueryString(query)}`,
    );
    return inventoryActivityPageFromResponse(body);
  }

  async getMyPurchases(query: Omit<PurchaseQuery, 'userId'> = {}): Promise<PurchasePage> {
    return purchasePageFromResponse(
      await this.request(`/purchases/me${purchaseQueryString(query)}`),
    );
  }

  async getAdminPurchases(query: PurchaseQuery = {}): Promise<PurchasePage> {
    return purchasePageFromResponse(
      await this.request(`/admin/purchases${purchaseQueryString(query)}`),
    );
  }

  async getAdminDashboard(period: DashboardPeriod = '30d'): Promise<DashboardData> {
    return dashboardFromResponse(
      await this.request(`/admin/dashboard?${new URLSearchParams({ period }).toString()}`),
    );
  }

  async previewVehicleCsv(file: File): Promise<VehicleCsvPreview> {
    const form = new FormData();
    form.append('file', file);
    return vehicleCsvPreviewFromResponse(
      await this.request('/admin/vehicles/import/preview', { method: 'POST', body: form }),
    );
  }

  async importVehicleCsv(file: File): Promise<{ imported: number }> {
    const form = new FormData();
    form.append('file', file);
    const body = await this.request('/admin/vehicles/import', { method: 'POST', body: form });
    if (isRecord(body) && isRecord(body.data) && typeof body.data.imported === 'number') {
      return { imported: body.data.imported };
    }
    throw invalidResponseError();
  }

  async exportVehicleCsv(): Promise<Blob> {
    const response = await this.authorizedFetch('/admin/vehicles/export', {
      headers: { Accept: 'text/csv' },
    });
    return response.blob();
  }
}

export const apiClient = new ApiClient();
