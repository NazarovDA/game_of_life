import { CreateWorld, GetWorlds } from './types';
export * from './types';

export class API {
  private static root: string = 'http://localhost:8080/api';
  // private static wsRoot: string = 'http://localhost:8080/ws';
  private static headers: Headers = new Headers({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  });

  async createWorld(options: CreateWorld['request']['body']): Promise<CreateWorld['response']> {
    const response = await fetch(`${API.root}/world`, {
      method: 'POST',
      headers: API.headers,
      body: JSON.stringify(options),
    });
    const allowedStatuses = [200, 400, 500] as const;
    if (!allowedStatuses.includes(response.status as any)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
    let status = response.status as (typeof allowedStatuses)[number];

    return {
      status,
      body: await response.json(),
    };
  }

  async getWorlds(): Promise<GetWorlds['response']> {
    const response = await fetch(`${API.root}/world`, {
      method: 'GET',
      headers: API.headers,
    });
    const allowedStatuses = [200, 500] as const;
    if (!allowedStatuses.includes(response.status as any)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
    let status = response.status as (typeof allowedStatuses)[number];

    return {
      status,
      body: await response.json(),
    };
  }

  setServerEndpoint(endpoint: string) {
    API.root = endpoint;
  }
}

export const api = new API();
