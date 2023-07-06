// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageDefinition } from "@foxglove/message-definition";
import { parse as parseMessageDefinition, parseRos2idl } from "@foxglove/rosmsg";
import { MessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";

import { parseFlatbufferSchema } from "./parseFlatbufferSchema";
import { parseJsonSchema } from "./parseJsonSchema";
import { parseProtobufSchema } from "./parseProtobufSchema";
import { MessageDefinitionMap } from "./types";

type Channel = {
  messageEncoding: string;
  schema: { name: string; encoding: string; data: Uint8Array } | undefined;
};

export type ParsedChannel = {
  deserialize: (data: ArrayBufferView) => unknown;
  datatypes: MessageDefinitionMap;
};

function parsedDefinitionsToDatatypes(
  parsedDefinitions: MessageDefinition[],
  rootName: string,
): MessageDefinitionMap {
  const datatypes: MessageDefinitionMap = new Map();
  parsedDefinitions.forEach(({ name, definitions }, index) => {
    if (index === 0) {
      datatypes.set(rootName, { name: rootName, definitions });
    } else if (name != undefined) {
      datatypes.set(name, { name, definitions });
    }
  });
  return datatypes;
}

/**
 * Process a channel/schema and extract information that can be used to deserialize messages on the
 * channel, and schemas in the format expected by Studio's RosDatatypes.
 *
 * See:
 * - https://github.com/foxglove/mcap/blob/main/docs/specification/well-known-message-encodings.md
 * - https://github.com/foxglove/mcap/blob/main/docs/specification/well-known-schema-encodings.md
 */
export function parseChannel(channel: Channel): ParsedChannel {
  if (channel.messageEncoding === "json") {
    if (channel.schema != undefined && channel.schema.encoding !== "jsonschema") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with schema encoding '${channel.schema.encoding}' is not supported (expected jsonschema or no schema)`,
      );
    }
    const textDecoder = new TextDecoder();
    let datatypes: MessageDefinitionMap = new Map();
    let deserialize = (data: ArrayBufferView) => JSON.parse(textDecoder.decode(data));
    if (channel.schema != undefined) {
      const schema =
        channel.schema.data.length > 0
          ? JSON.parse(textDecoder.decode(channel.schema.data))
          : undefined;
      if (schema != undefined) {
        if (typeof schema !== "object") {
          throw new Error(`Invalid schema, expected JSON object, got ${typeof schema}`);
        }
        const { datatypes: parsedDatatypes, postprocessValue } = parseJsonSchema(
          schema as Record<string, unknown>,
          channel.schema.name,
        );
        datatypes = parsedDatatypes;
        deserialize = (data) =>
          postprocessValue(JSON.parse(textDecoder.decode(data)) as Record<string, unknown>);
      }
    }
    return { deserialize, datatypes };
  }

  if (channel.messageEncoding === "flatbuffer") {
    if (channel.schema?.encoding !== "flatbuffer") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected flatbuffer)`,
      );
    }
    return parseFlatbufferSchema(channel.schema.name, channel.schema.data);
  }

  if (channel.messageEncoding === "protobuf") {
    if (channel.schema?.encoding !== "protobuf") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected protobuf)`,
      );
    }
    return parseProtobufSchema(channel.schema.name, channel.schema.data);
  }

  if (channel.messageEncoding === "ros1") {
    if (channel.schema?.encoding !== "ros1msg") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected ros1msg)`,
      );
    }
    const schema = new TextDecoder().decode(channel.schema.data);
    const parsedDefinitions = parseMessageDefinition(schema);
    const reader = new MessageReader(parsedDefinitions);
    return {
      datatypes: parsedDefinitionsToDatatypes(parsedDefinitions, channel.schema.name),
      deserialize: (data) => reader.readMessage(data),
    };
  }

  if (channel.messageEncoding === "cdr") {
    if (channel.schema?.encoding !== "ros2msg" && channel.schema?.encoding !== "ros2idl") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected "ros2msg" or "ros2idl")`,
      );
    }
    const schema = new TextDecoder().decode(channel.schema.data);
    const isIdl = channel.schema.encoding === "ros2idl";

    const parsedDefinitions = isIdl
      ? parseRos2idl(schema)
      : parseMessageDefinition(schema, { ros2: true });

    const reader = new ROS2MessageReader(parsedDefinitions);
    return {
      datatypes: parsedDefinitionsToDatatypes(parsedDefinitions, channel.schema.name),
      deserialize: (data) => reader.readMessage(data),
    };
  }

  throw new Error(`Unsupported encoding ${channel.messageEncoding}`);
}
