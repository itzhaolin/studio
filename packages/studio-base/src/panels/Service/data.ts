// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type ServiceMap = {
  [key: string]: {
    name: string;
    btnColor?: string;
    serviceName: string;
    request: Record<string, any>;
  };
};

export const LOCAL_STORAGE_KEY = "serviceList";

export type ServiceParam = {
  name: string;
  param: string;
};

export const DEFAULT_PARAMS = {
  serviceName: "/example",
  request: { name: "zhangsan" },
};

export const SERVICE_MAPPING: ServiceMap = {
  stop: {
    name: "Stop Task",
    btnColor: "secondary",
    serviceName: "/app/service/stop_task",
    request: {},
  },
};
