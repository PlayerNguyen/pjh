import type { JsonSchema, JsonSchemaProperty } from "$lib/api";

export interface FieldDescriptor {
  name: string;
  label: string;
  description?: string;
  type: "string" | "number" | "integer" | "boolean" | "select";
  default?: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
  minimum?: number;
  maximum?: number;
}

/**
 * Flattens a draft-07 JSON Schema object into a list of fields the dashboard
 * can render. Only top-level scalar properties and string enums are supported.
 */
export function schemaToFields(schema: JsonSchema): FieldDescriptor[] {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  return Object.entries(props).map(([name, prop]: [string, JsonSchemaProperty]) => {
    const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;

    let fieldType: FieldDescriptor["type"] = "string";
    if (type === "boolean") fieldType = "boolean";
    else if (type === "integer") fieldType = "integer";
    else if (type === "number") fieldType = "number";
    if (prop.enum && prop.enum.length > 0) fieldType = "select";

    return {
      name,
      label: prop.title ?? name,
      description: prop.description,
      type: fieldType,
      default: prop.default,
      required: required.has(name),
      options: prop.enum?.map((v) => ({ value: String(v), label: String(v) })),
      minimum: prop.minimum,
      maximum: prop.maximum,
    };
  });
}
