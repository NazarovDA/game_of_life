export interface GenericEndpoint {
  request: {
    body: any;
    query: any;
  };
  response: {
    status: number;
    body: any;
  };
}

/** POST /world */
export interface CreateWorld extends GenericEndpoint {
  request: {
    body: {
      /** world name */
      name: string;
      /** world width */
      x: number;
      /** world height */
      y: number;
      /** immediately start simulation */
      start?: boolean;
    };
    query: any;
  }
  response: {
    status: 200;
    body: {
      ok: true;
      /** world id */
      id: number | string;
    };
  } | {
    status: 400;
    body: {
      ok: false;
      error: string;
    };
  } | {
    status: 500;
    body: {
      ok: false;
      error: string;
    };
  };
}

/** GET /world */
export interface GetWorlds extends GenericEndpoint {
  request: {
    body: never;
    query: any;
  };
  response: {
    status: 200;
    body: {
      ok: true;
      items: Array<{
        /** world id */
        id: number | string;
        name: string;
        x: number;
        y: number;
        /** uint64 (!) */
        epoch: number | string;
        isRunning: boolean;
      }>;
    }
  } | {
    status: 500;
    body: {
      ok: false;
      error: string;
    };
  }
}
