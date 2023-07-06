// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TextField, Button, Divider, Checkbox, Collapse, Select, MenuItem } from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { StrictMode, useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { makeStyles } from "tss-react/mui";

import { PanelExtensionContext } from "@foxglove/studio";
import Panel from "@foxglove/studio-base/components/Panel";
import { PanelExtensionAdapter } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import Stack from "@foxglove/studio-base/components/Stack";
import ObjectDetails from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/ObjectDetails";
import { RosValue } from "@foxglove/studio-base/players/types";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { SERVICE_MAPPING, LOCAL_STORAGE_KEY, DEFAULT_PARAMS, ServiceParam } from "./data";
import helpContent from "./index.help.md";

const useStyles = makeStyles()(() => ({
  taskTitle: {
    fontWeight: "bolder",
    fontSize: 16,
  },
  btnList: {
    Button: {
      margin: 2,
    },
  },
  expandIcon: {
    marginLeft: 5,
    cursor: "pointer",
  },
  historyTitle: {
    width: 130,
    fontSize: 12,
    fontWeight: "bolder",
  },
}));

function initPanel(context: PanelExtensionContext) {
  ReactDOM.render(
    <StrictMode>
      <Service context={context} />
    </StrictMode>,
    context.panelElement,
  );
}

type QuestState = {
  serviceName: string;
  request: string;
  response?: RosValue;
  error?: string;
};

function Service({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { classes } = useStyles();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { callService } = context;
  const [questParams, setQuestParams] = useState<QuestState>({
    serviceName: DEFAULT_PARAMS.serviceName,
    request: JSON.stringify(DEFAULT_PARAMS.request, undefined, 2) ?? "",
  });

  const stateRef = useRef<QuestState>(questParams);

  const quickTaskNameList = useMemo(() => {
    return Object.values(SERVICE_MAPPING).map((v) => v.serviceName);
  }, []);

  const serviceList = useMemo(() => {
    const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? "[]");
    return data;
  }, []);

  const [currentServiceList, setCurrentServiceList] = useState<Array<ServiceParam>>([]);

  useEffect(() => {
    setCurrentServiceList(serviceList as Array<ServiceParam>);
  }, [serviceList]);

  useEffect(() => {
    stateRef.current = questParams;
  }, [questParams]);

  const addServiceList = useCallback(
    (serviceItem: ServiceParam) => {
      // 存在快捷任务中  和  已经记录的数据 不添加
      const hasServiceName =
        quickTaskNameList.includes(serviceItem.name) ||
        currentServiceList.findIndex((v) => v.name === serviceItem.name) > -1;
      if (!hasServiceName) {
        const currentStoreList = [...currentServiceList, serviceItem];
        setCurrentServiceList(currentStoreList);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentStoreList) ?? "[]");
      }
    },
    [quickTaskNameList, currentServiceList],
  );

  const handleCall = useCallback(async () => {
    if (!callService || !stateRef.current.serviceName || !stateRef.current.request) {
      setQuestParams((prev) => ({
        ...prev,
        error: "Please input params or is not support call service",
      }));
      return;
    }

    try {
      setQuestParams((prev) => ({ ...prev, response: undefined, error: undefined }));
      const params = JSON.parse(stateRef.current.request ?? "");
      const response = (await callService(stateRef.current.serviceName, params)) as RosValue;
      setQuestParams((prev) => ({
        ...prev,
        response,
        error: undefined,
      }));
      // service 请求成功后记录
      addServiceList({ name: stateRef.current.serviceName, param: stateRef.current.request });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setQuestParams((prev) => ({
        ...prev,
        error: `${error?.name}: ${error?.message}` ?? "unkonw error",
      }));
    }
  }, [callService, addServiceList]);

  const quickTask = useCallback(
    (type: string) => {
      const req = SERVICE_MAPPING[type as keyof typeof SERVICE_MAPPING];
      if (req == undefined) {
        setQuestParams((prev) => ({
          ...prev,
          error: "undefined service mapping name",
        }));
        return;
      }
      setQuestParams((prev) => ({
        ...prev,
        serviceName: req.serviceName,
        request: JSON.stringify(req.request, undefined, 2) ?? "",
      }));
      setTimeout(() => {
        void handleCall();
      }, 0);
    },
    [handleCall],
  );

  const isCleanCarpet = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      quickTask(event.target.checked ? "cleanCarpet" : "notCleanCarpet");
    },
    [quickTask],
  );

  const btnListRender = useCallback(() => {
    const btnValues = Object.keys(SERVICE_MAPPING).reduce(
      (s: Array<Record<string, any>>, v: string) => {
        if (SERVICE_MAPPING[v]?.name !== "") {
          s.push({ ...SERVICE_MAPPING[v], taksType: v } as Record<string, any>);
        }
        return s;
      },
      [],
    );
    return btnValues.map((v: Record<string, any>) => (
      <Button
        variant="contained"
        color={v.btnColor ?? "primary"}
        onClick={() => quickTask(v.taksType as string)}
        key={v.taksType}
      >
        {v.name}
      </Button>
    ));
  }, [quickTask]);

  const renderOptions = useCallback(() => {
    return currentServiceList.map((v) => (
      <MenuItem value={v.param} key={v.name}>
        {v.name}
      </MenuItem>
    ));
  }, [currentServiceList]);

  return (
    <>
      <Stack paddingX={1}>
        <Stack direction="row" alignItems="center">
          <span className={classes.taskTitle}>Quick Task:</span>
          &nbsp; &nbsp;
          <span>
            <Checkbox onChange={isCleanCarpet} />
            Select Carpet
          </span>
          <span
            onClick={() => setExpanded(!expanded)}
            className={classes.expandIcon}
            style={{
              transform: !expanded ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <ExpandMoreIcon />
          </span>
        </Stack>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack
            direction="row"
            justifyContent="flex-start"
            flexWrap="wrap"
            className={classes.btnList}
          >
            {btnListRender()}
          </Stack>
        </Collapse>
        <Stack direction="row" alignItems="center" style={{ marginTop: 5 }}>
          <span className={classes.historyTitle}>History records:</span>
          <Select
            size="small"
            fullWidth
            onChange={(event: SelectChangeEvent, child: React.ReactNode) => {
              const value = child?.valueOf() as Record<string, any>;
              setQuestParams((prev) => ({
                ...prev,
                serviceName: value.props.children,
                request: event.target.value, // 已转好 JSON格式
              }));
            }}
          >
            {renderOptions()}
          </Select>
        </Stack>
        <Stack direction="row" justifyContent="space-between" style={{ marginTop: 10 }}></Stack>
      </Stack>
      <Stack padding={2} gapX={1}>
        <TextField
          label="Service name"
          variant="outlined"
          value={questParams.serviceName}
          onChange={(event) =>
            setQuestParams((prev) => ({ ...prev, serviceName: event.target.value }))
          }
        />
        <TextField
          label="Request"
          multiline
          rows={6}
          variant="outlined"
          value={questParams.request}
          onChange={(event) => setQuestParams((prev) => ({ ...prev, request: event.target.value }))}
        />
        <Button variant="contained" onClick={handleCall}>
          Call
        </Button>
      </Stack>
      <Divider />
      {questParams.error != undefined ? (
        <Stack justifyContent="center" paddingTop={2}>
          <span style={{ color: "red", textAlign: "center" }}>
            {JSON.stringify(questParams.error)}
          </span>
        </Stack>
      ) : (
        <Stack paddingX={2} overflowY="auto" style={{ maxHeight: 800 }}>
          <ObjectDetails selectedObject={questParams.response ?? {}} type="callService" />
        </Stack>
      )}
    </>
  );
}

function ServiceAdapter(props: { config: unknown; saveConfig: SaveConfig<unknown> }) {
  return (
    <PanelExtensionAdapter
      config={props.config}
      saveConfig={props.saveConfig}
      help={helpContent}
      initPanel={initPanel}
    />
  );
}

ServiceAdapter.panelType = "Service";
ServiceAdapter.defaultConfig = {};

export default Panel(ServiceAdapter);
